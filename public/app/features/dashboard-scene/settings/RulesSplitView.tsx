import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Badge, useStyles2 } from '@grafana/ui';

import { DashboardRule, RuleTarget } from '../conditional-rendering/rules/DashboardRule';
import { DashboardScene } from '../scene/DashboardScene';

import { DashboardRulesFlowEditor } from './DashboardRulesFlowEditor';
import { SentenceBuilder } from './RulesBuilderView';

interface Props {
  dashboard: DashboardScene;
}

// ---------------------------------------------------------------------------
// Team name resolution
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

  const targetNames = rule.state.targets.map((t) => formatTargetName(t));
  if (targetNames.length > 0) {
    parts.push(targetNames.join(', '));
  } else if (!parts.some((p) => p.startsWith('Set refresh'))) {
    parts.push('dashboard');
  }

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
// Component
// ---------------------------------------------------------------------------

export function RulesSplitView({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { dashboardRules } = dashboard.useState();
  const rulesState = dashboardRules?.useState();
  const rules = rulesState?.rules ?? [];
  const teamNames = useTeamNames(rules);

  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(undefined);

  // Build a set containing only the selected rule for the flow editor highlight
  const highlightedRules = useMemo(() => {
    if (selectedIndex === undefined) {
      return undefined;
    }
    return new Set([selectedIndex]);
  }, [selectedIndex]);

  if (rules.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.detailPanel}>
          <div className={styles.builderStrip}>
            <SentenceBuilder dashboard={dashboard} />
          </div>
          <div className={styles.flowArea}>
            <DashboardRulesFlowEditor dashboard={dashboard} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left: rule list */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <span className={styles.listHeaderTitle}>Rules ({rules.length})</span>
        </div>
        <div className={styles.listScroll}>
          {rules.map((rule, index) => (
            <RuleListItem
              key={index}
              rule={rule}
              index={index}
              isSelected={selectedIndex === index}
              teamNames={teamNames}
              onClick={() => setSelectedIndex(selectedIndex === index ? undefined : index)}
            />
          ))}
        </div>
      </div>

      {/* Right: builder + flow editor */}
      <div className={styles.detailPanel}>
        <div className={styles.builderStrip}>
          <SentenceBuilder dashboard={dashboard} />
        </div>
        <div className={styles.flowArea}>
          <DashboardRulesFlowEditor dashboard={dashboard} simulatedActiveRules={highlightedRules} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule list item
// ---------------------------------------------------------------------------

interface RuleListItemProps {
  rule: DashboardRule;
  index: number;
  isSelected: boolean;
  teamNames: TeamNameMap;
  onClick: () => void;
}

function RuleListItem({ rule, index, isSelected, teamNames, onClick }: RuleListItemProps) {
  const styles = useStyles2(getStyles);
  const { active, name, outcomes } = rule.useState();

  const summary = useMemo(() => summarizeRule(rule, teamNames), [rule, teamNames]);

  return (
    <button className={cx(styles.listItem, isSelected && styles.listItemSelected)} onClick={onClick}>
      <div className={styles.listItemHeader}>
        <span className={cx(styles.statusDot, active ? styles.statusActive : styles.statusInactive)} />
        <span className={styles.listItemName}>{name ?? `Rule ${index + 1}`}</span>
        <div className={styles.listItemBadges}>
          {outcomes.map((o, i) => (
            <Badge key={i} text={outcomeShortLabel(o.kind)} color={active ? 'green' : 'blue'} />
          ))}
        </div>
      </div>
      <div className={styles.listItemSummary}>{summary}</div>
    </button>
  );
}

function outcomeShortLabel(kind: string): string {
  switch (kind) {
    case 'DashboardRuleOutcomeVisibility':
      return 'Visibility';
    case 'DashboardRuleOutcomeCollapse':
      return 'Collapse';
    case 'DashboardRuleOutcomeRefreshInterval':
      return 'Refresh';
    case 'DashboardRuleOutcomeOverrideQuery':
      return 'Query';
    default:
      return kind;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flex: 1,
      height: '100%',
      overflow: 'hidden',
    }),
    empty: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
    }),

    // Left panel: rule list
    listPanel: css({
      display: 'flex',
      flexDirection: 'column',
      width: 360,
      minWidth: 280,
      flexShrink: 0,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    listHeader: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
    }),
    listHeaderTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,
    }),
    listScroll: css({
      flex: 1,
      overflow: 'auto',
      padding: theme.spacing(0.5),
    }),
    listItem: css({
      display: 'block',
      width: '100%',
      padding: theme.spacing(0.75, 1),
      marginBottom: theme.spacing(0.5),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'border-color 0.15s ease',
      '&:hover': {
        borderColor: theme.colors.border.medium,
        background: theme.colors.background.secondary,
      },
    }),
    listItemSelected: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
      '&:hover': {
        borderColor: theme.colors.primary.border,
      },
    }),
    listItemHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      marginBottom: theme.spacing(0.25),
    }),
    listItemName: css({
      flex: 1,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    listItemBadges: css({
      display: 'flex',
      gap: theme.spacing(0.25),
      flexShrink: 0,
    }),
    listItemSummary: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      lineHeight: 1.4,
    }),
    statusDot: css({
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
    }),
    statusActive: css({
      background: theme.colors.success.main,
    }),
    statusInactive: css({
      background: theme.colors.text.disabled,
    }),

    // Right panel: builder strip + flow editor
    detailPanel: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    }),
    builderStrip: css({
      flexShrink: 0,
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
    }),
    flowArea: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }),
  };
}
