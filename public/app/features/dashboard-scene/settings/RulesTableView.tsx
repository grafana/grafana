import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Badge, Icon, useStyles2 } from '@grafana/ui';

import { DashboardRule, RuleTarget } from '../conditional-rendering/rules/DashboardRule';
import { DashboardScene } from '../scene/DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

// ---------------------------------------------------------------------------
// Team name resolution (shared pattern with RulesSimulator)
// ---------------------------------------------------------------------------

type TeamNameMap = Map<string, string>;

function useTeamNames(rules: DashboardRule[]): TeamNameMap {
  const [teamNames, setTeamNames] = useState<TeamNameMap>(new Map());

  const teamUids = useMemo(() => {
    const uids = new Set<string>();
    for (const rule of rules) {
      for (const condition of rule.state.conditions) {
        const serialized = condition.serialize();
        if (serialized.kind === 'ConditionalRenderingUserTeam') {
          for (const uid of serialized.spec.teamUids as string[]) {
            uids.add(uid);
          }
        }
      }
    }
    return uids;
  }, [rules]);

  useEffect(() => {
    if (teamUids.size === 0) {
      return;
    }

    let cancelled = false;

    async function fetchTeams() {
      try {
        const response = await getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 });
        if (cancelled) {
          return;
        }
        const nameMap = new Map<string, string>();
        for (const team of response.teams ?? []) {
          nameMap.set(team.uid, team.name);
        }
        setTeamNames(nameMap);
      } catch {
        // ignore
      }
    }

    fetchTeams();
    return () => {
      cancelled = true;
    };
  }, [teamUids]);

  return teamNames;
}

// ---------------------------------------------------------------------------
// Natural language summary
// ---------------------------------------------------------------------------

function summarizeRule(rule: DashboardRule, teamNames: TeamNameMap): string {
  const parts: string[] = [];

  // Outcomes
  for (const outcome of rule.state.outcomes) {
    switch (outcome.kind) {
      case 'DashboardRuleOutcomeVisibility':
        parts.push(outcome.spec.visibility === 'hide' ? 'Hide' : 'Show');
        break;
      case 'DashboardRuleOutcomeCollapse':
        parts.push(outcome.spec.collapse ? 'Collapse' : 'Expand');
        break;
      case 'DashboardRuleOutcomeRefreshInterval':
        parts.push(`Set refresh to ${outcome.spec.interval}`);
        break;
      case 'DashboardRuleOutcomeOverrideQuery':
        parts.push('Override queries of');
        break;
    }
  }

  // Targets
  const targetNames = rule.state.targets.map((t) => formatTargetName(t));
  if (targetNames.length > 0) {
    parts.push(targetNames.join(', '));
  } else if (!parts.some((p) => p.startsWith('Set refresh'))) {
    parts.push('dashboard');
  }

  // Conditions
  const condParts: string[] = [];
  for (const condition of rule.state.conditions) {
    const serialized = condition.serialize();
    condParts.push(summarizeCondition(serialized, teamNames));
  }

  if (condParts.length > 0) {
    const joiner = rule.state.match === 'and' ? ' and ' : ' or ';
    parts.push('when ' + condParts.join(joiner));
  }

  return parts.join(' ');
}

function formatTargetName(target: RuleTarget): string {
  const name = target.name.replace(/^(panel-|row-|tab-)/, '').replace(/-/g, ' ');
  const kind =
    target.kind === 'ElementReference'
      ? 'panel'
      : target.name.startsWith('row-')
        ? 'row'
        : target.name.startsWith('tab-')
          ? 'tab'
          : 'element';
  return `'${name}' ${kind}`;
}

function summarizeCondition(serialized: { kind: string; spec: Record<string, any> }, teamNames: TeamNameMap): string {
  switch (serialized.kind) {
    case 'ConditionalRenderingTimeRangeSize': {
      return `time range < ${serialized.spec.value}`;
    }
    case 'ConditionalRenderingUserTeam': {
      const operator = serialized.spec.operator as string;
      const uids = serialized.spec.teamUids as string[];
      const names = uids.map((uid) => teamNames.get(uid) ?? uid).join(', ');
      return operator === 'is_member' ? `user is member of ${names}` : `user is not member of ${names}`;
    }
    case 'ConditionalRenderingVariable': {
      const { variable, operator, value } = serialized.spec;
      return `$${variable} ${operator} ${value}`;
    }
    case 'ConditionalRenderingData': {
      return serialized.spec.value ? 'panel has data' : 'panel has no data';
    }
    default:
      return serialized.kind;
  }
}

// ---------------------------------------------------------------------------
// Outcome type label
// ---------------------------------------------------------------------------

function outcomeLabel(kind: string): string {
  switch (kind) {
    case 'DashboardRuleOutcomeVisibility':
      return 'Visibility';
    case 'DashboardRuleOutcomeCollapse':
      return 'Collapse';
    case 'DashboardRuleOutcomeRefreshInterval':
      return 'Refresh interval';
    case 'DashboardRuleOutcomeOverrideQuery':
      return 'Override query';
    default:
      return kind;
  }
}

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

interface RuleGroup {
  label: string;
  rules: Array<{ rule: DashboardRule; index: number }>;
}

function groupRules(rules: DashboardRule[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();

  rules.forEach((rule, index) => {
    const outcomeKinds = rule.state.outcomes.map((o) => o.kind);
    let groupKey: string;

    if (outcomeKinds.includes('DashboardRuleOutcomeVisibility')) {
      groupKey = 'Visibility rules';
    } else if (outcomeKinds.includes('DashboardRuleOutcomeCollapse')) {
      groupKey = 'Collapse rules';
    } else if (outcomeKinds.includes('DashboardRuleOutcomeRefreshInterval')) {
      groupKey = 'Refresh interval rules';
    } else if (outcomeKinds.includes('DashboardRuleOutcomeOverrideQuery')) {
      groupKey = 'Query override rules';
    } else {
      groupKey = 'Other rules';
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { label: groupKey, rules: [] });
    }
    groups.get(groupKey)!.rules.push({ rule, index });
  });

  return Array.from(groups.values());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RulesTableView({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { dashboardRules } = dashboard.useState();
  const rulesState = dashboardRules?.useState();
  const rules = rulesState?.rules ?? [];
  const teamNames = useTeamNames(rules);

  const groups = useMemo(() => groupRules(rules), [rules]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  if (rules.length === 0) {
    return <div className={styles.empty}>No rules configured. Switch to the flow editor to add rules.</div>;
  }

  return (
    <div className={styles.container}>
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.label);
        return (
          <div key={group.label} className={styles.group}>
            <button className={styles.groupHeader} onClick={() => toggleGroup(group.label)}>
              <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} size="md" />
              <span className={styles.groupLabel}>{group.label}</span>
              <Badge text={String(group.rules.length)} color="blue" />
            </button>
            {!isCollapsed && (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={cx(styles.cell, styles.cellStatus)} />
                  <div className={cx(styles.cell, styles.cellName)}>Name</div>
                  <div className={cx(styles.cell, styles.cellSummary)}>Summary</div>
                  <div className={cx(styles.cell, styles.cellTargets)}>Targets</div>
                  <div className={cx(styles.cell, styles.cellOutcome)}>Outcome</div>
                </div>
                {group.rules.map(({ rule, index }) => (
                  <RuleRow key={index} rule={rule} index={index} teamNames={teamNames} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RuleRow({ rule, index, teamNames }: { rule: DashboardRule; index: number; teamNames: TeamNameMap }) {
  const styles = useStyles2(getStyles);
  const { active, name, targets, outcomes } = rule.useState();

  const summary = useMemo(() => summarizeRule(rule, teamNames), [rule, teamNames]);

  const targetLabels = targets.map((t) => formatTargetName(t));
  const outcomeLabels = outcomes.map((o) => outcomeLabel(o.kind));

  return (
    <div className={cx(styles.tableRow, active && styles.tableRowActive)}>
      <div className={cx(styles.cell, styles.cellStatus)}>
        <span className={cx(styles.statusDot, active ? styles.statusActive : styles.statusInactive)} />
      </div>
      <div className={cx(styles.cell, styles.cellName)}>
        <span className={styles.ruleName}>{name ?? `Rule ${index + 1}`}</span>
      </div>
      <div className={cx(styles.cell, styles.cellSummary)}>
        <span className={styles.summaryText}>{summary}</span>
      </div>
      <div className={cx(styles.cell, styles.cellTargets)}>
        {targetLabels.length > 0 ? (
          targetLabels.map((label, i) => (
            <span key={i} className={styles.chip}>
              {label}
            </span>
          ))
        ) : (
          <span className={styles.chipMuted}>dashboard</span>
        )}
      </div>
      <div className={cx(styles.cell, styles.cellOutcome)}>
        {outcomeLabels.map((label, i) => (
          <Badge key={i} text={label} color="blue" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
      padding: theme.spacing(1),
      gap: theme.spacing(1),
    }),
    empty: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
    }),
    group: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    groupHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
      padding: theme.spacing(0.75, 1),
      background: theme.colors.background.secondary,
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    groupLabel: css({
      flex: 1,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,
    }),
    table: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    tableHeader: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0.5, 1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
    tableRow: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0.75, 1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      transition: 'background 0.1s ease',
      '&:last-child': {
        borderBottom: 'none',
      },
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    tableRowActive: css({
      borderLeft: `3px solid ${theme.colors.success.main}`,
    }),
    cell: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flexWrap: 'wrap',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    cellStatus: css({
      width: 24,
      flexShrink: 0,
      justifyContent: 'center',
    }),
    cellName: css({
      width: 140,
      flexShrink: 0,
    }),
    cellSummary: css({
      flex: 1,
      minWidth: 200,
    }),
    cellTargets: css({
      width: 180,
      flexShrink: 0,
    }),
    cellOutcome: css({
      width: 130,
      flexShrink: 0,
    }),
    statusDot: css({
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
    }),
    statusActive: css({
      background: theme.colors.success.main,
    }),
    statusInactive: css({
      background: theme.colors.text.disabled,
    }),
    ruleName: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
    summaryText: css({
      color: theme.colors.text.secondary,
      lineHeight: 1.4,
    }),
    chip: css({
      display: 'inline-block',
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
    }),
    chipMuted: css({
      display: 'inline-block',
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
  };
}
