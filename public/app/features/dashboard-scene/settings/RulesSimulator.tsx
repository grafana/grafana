import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Badge, Button, useStyles2 } from '@grafana/ui';

import { DashboardRule } from '../conditional-rendering/rules/DashboardRule';
import { DashboardScene } from '../scene/DashboardScene';

interface Props {
  dashboard: DashboardScene;
  onSelectScenario: (activeRules: Set<number> | undefined) => void;
  selectedRules: Set<number> | undefined;
}

// ---------------------------------------------------------------------------
// Condition dimension: a unique "axis" that can be true or false
// ---------------------------------------------------------------------------

interface ConditionDimension {
  /** Stable key for deduplication, e.g. "time:<5m" or "team:is_not_member:uid1,uid2" */
  key: string;
  /** Human-readable label shown in the UI */
  label: string;
  /** Label when this dimension is true */
  trueLabel: string;
  /** Label when this dimension is false */
  falseLabel: string;
}

// ---------------------------------------------------------------------------
// Scenario: a unique dashboard configuration produced by a set of condition values
// ---------------------------------------------------------------------------

interface DimensionValue {
  /** Dimension label (e.g. "Time range < 5m") */
  dimension: string;
  /** Resolved value label (e.g. "< 5m" or ">= 5m") */
  value: string;
  /** Whether the condition is satisfied */
  satisfied: boolean;
}

interface Scenario {
  /** Per-dimension values for display */
  dimensionValues: DimensionValue[];
  /** Which rules (by index) are active in this scenario */
  activeRules: Set<number>;
  /** The condition values that produce this scenario (for deduplication key) */
  conditionValues: boolean[];
}

// ---------------------------------------------------------------------------
// Extract unique condition dimensions from all rules
// ---------------------------------------------------------------------------

type TeamNameMap = Map<string, string>;

function extractDimensions(rules: DashboardRule[], teamNames?: TeamNameMap): ConditionDimension[] {
  const seen = new Map<string, ConditionDimension>();

  for (const rule of rules) {
    for (const condition of rule.state.conditions) {
      const serialized = condition.serialize();
      const dim = dimensionFromSerialized(serialized, teamNames);
      if (dim && !seen.has(dim.key)) {
        seen.set(dim.key, dim);
      }
    }
  }

  return Array.from(seen.values());
}

function resolveTeamNames(uids: string[], teamNames?: TeamNameMap): string {
  if (!teamNames) {
    return uids.join(', ');
  }
  return uids.map((uid) => teamNames.get(uid) ?? uid).join(', ');
}

function dimensionFromSerialized(
  serialized: { kind: string; spec: Record<string, any> },
  teamNames?: TeamNameMap
): ConditionDimension | null {
  switch (serialized.kind) {
    case 'ConditionalRenderingTimeRangeSize': {
      const value = serialized.spec.value as string;
      return {
        key: `time:<${value}`,
        label: 'Time range',
        trueLabel: `< ${value}`,
        falseLabel: `>= ${value}`,
      };
    }
    case 'ConditionalRenderingUserTeam': {
      const operator = serialized.spec.operator as string;
      const uids = ((serialized.spec.teamUids as string[] | undefined) ?? []).sort();
      const names = resolveTeamNames(uids, teamNames);
      return {
        key: `team:${operator}:${uids.join(',')}`,
        label: names,
        trueLabel: operator === 'is_member' ? 'member' : 'not member',
        falseLabel: operator === 'is_member' ? 'not member' : 'member',
      };
    }
    case 'ConditionalRenderingVariable': {
      const { variable, operator, value } = serialized.spec;
      return {
        key: `var:${variable}:${operator}:${value}`,
        label: `$${variable}`,
        trueLabel: `${operator} ${value}`,
        falseLabel: `not ${operator} ${value}`,
      };
    }
    case 'ConditionalRenderingData': {
      const hasData = serialized.spec.value as boolean;
      return {
        key: `data:${hasData}`,
        label: 'Data',
        trueLabel: hasData ? 'has data' : 'no data',
        falseLabel: hasData ? 'no data' : 'has data',
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Match a condition against a set of dimension values
// ---------------------------------------------------------------------------

function conditionKeyFromSerialized(serialized: { kind: string; spec: Record<string, any> }): string | null {
  const dim = dimensionFromSerialized(serialized);
  return dim?.key ?? null;
}

// ---------------------------------------------------------------------------
// Generate all scenarios by evaluating every 2^N combination
// ---------------------------------------------------------------------------

function generateScenarios(rules: DashboardRule[], dimensions: ConditionDimension[]): Scenario[] {
  const n = dimensions.length;
  if (n === 0) {
    return [];
  }

  // Cap at 2^7 = 128 combinations
  const maxBits = Math.min(n, 7);
  const totalCombinations = 1 << maxBits;

  // Build a map from dimension key -> index for quick lookup
  const dimIndexMap = new Map<string, number>();
  dimensions.forEach((d, i) => {
    if (i < maxBits) {
      dimIndexMap.set(d.key, i);
    }
  });

  // For deduplication: map from sorted active-rule-indices string to scenario
  const uniqueScenarios = new Map<string, Scenario>();

  for (let combo = 0; combo < totalCombinations; combo++) {
    const conditionValues: boolean[] = [];
    for (let bit = 0; bit < maxBits; bit++) {
      conditionValues.push((combo & (1 << bit)) !== 0);
    }

    // Evaluate each rule
    const activeRules = new Set<number>();

    rules.forEach((rule, ruleIdx) => {
      const condResults: boolean[] = [];

      for (const condition of rule.state.conditions) {
        const serialized = condition.serialize();
        const key = conditionKeyFromSerialized(serialized);
        if (key !== null && dimIndexMap.has(key)) {
          condResults.push(conditionValues[dimIndexMap.get(key)!]);
        }
        // Conditions with unknown dimensions are treated as true (optimistic)
      }

      if (condResults.length === 0) {
        activeRules.add(ruleIdx);
        return;
      }

      const active = rule.state.match === 'and' ? condResults.every(Boolean) : condResults.some(Boolean);

      if (active) {
        activeRules.add(ruleIdx);
      }
    });

    // Deduplication key: sorted list of active rule indices
    const dedupKey = Array.from(activeRules)
      .sort((a, b) => a - b)
      .join(',');

    if (!uniqueScenarios.has(dedupKey)) {
      const dimensionValues: DimensionValue[] = [];
      for (let bit = 0; bit < maxBits; bit++) {
        const dim = dimensions[bit];
        const satisfied = conditionValues[bit];
        dimensionValues.push({
          dimension: dim.label,
          value: satisfied ? dim.trueLabel : dim.falseLabel,
          satisfied,
        });
      }

      uniqueScenarios.set(dedupKey, {
        dimensionValues,
        activeRules,
        conditionValues,
      });
    }
  }

  // Sort scenarios by number of active rules (descending) for better readability
  return Array.from(uniqueScenarios.values()).sort((a, b) => b.activeRules.size - a.activeRules.size);
}

// ---------------------------------------------------------------------------
// Check if two Sets are equal
// ---------------------------------------------------------------------------

function setsEqual(a: Set<number> | undefined, b: Set<number>): boolean {
  if (!a) {
    return false;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const v of a) {
    if (!b.has(v)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function useTeamNames(rules: DashboardRule[]): TeamNameMap {
  const [teamNames, setTeamNames] = useState<TeamNameMap>(new Map());

  const teamUids = useMemo(() => {
    const uids = new Set<string>();
    for (const rule of rules) {
      for (const condition of rule.state.conditions) {
        const serialized = condition.serialize();
        if (serialized.kind === 'ConditionalRenderingUserTeam') {
          const teamUidsList = serialized.spec.teamUids as string[] | undefined;
          for (const uid of teamUidsList ?? []) {
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

const EMPTY_RULES: DashboardRule[] = [];

export function RulesSimulator({ dashboard, onSelectScenario, selectedRules }: Props) {
  const styles = useStyles2(getStyles);
  const { dashboardRules } = dashboard.useState();
  const rulesState = dashboardRules?.useState();
  const rules = rulesState?.rules ?? EMPTY_RULES;

  const teamNames = useTeamNames(rules);
  const dimensions = useMemo(() => extractDimensions(rules, teamNames), [rules, teamNames]);
  const scenarios = useMemo(() => generateScenarios(rules, dimensions), [rules, dimensions]);

  const totalRules = rules.length;

  if (rules.length === 0) {
    return <div className={styles.empty}>No rules configured. Add rules to see simulated scenarios.</div>;
  }

  if (dimensions.length === 0) {
    return <div className={styles.empty}>No conditions found. Rules without conditions are always active.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Simulator</span>
        <Button
          size="sm"
          variant={selectedRules === undefined ? 'primary' : 'secondary'}
          fill="text"
          onClick={() => onSelectScenario(undefined)}
        >
          Live
        </Button>
      </div>

      <div className={styles.dimList}>
        <span className={styles.dimLabel}>Dimensions ({dimensions.length})</span>
        {dimensions.map((d) => (
          <span key={d.key} className={styles.dimChip}>
            {d.label}
          </span>
        ))}
      </div>

      <div className={styles.scenarioList}>
        <span className={styles.scenarioCount}>{scenarios.length} unique configurations</span>
        {scenarios.map((scenario, idx) => {
          const isSelected = setsEqual(selectedRules, scenario.activeRules);
          return (
            <button
              key={idx}
              className={cx(styles.scenarioItem, isSelected && styles.scenarioItemSelected)}
              onClick={() => onSelectScenario(scenario.activeRules)}
            >
              <div className={styles.scenarioContent}>
                <div className={styles.scenarioDimensions}>
                  {scenario.dimensionValues.map((dv, i) => (
                    <div key={i} className={styles.scenarioDimRow}>
                      <span className={styles.scenarioDimName}>{dv.dimension}</span>
                      <span
                        className={cx(
                          styles.scenarioDimValue,
                          dv.satisfied ? styles.dimValueTrue : styles.dimValueFalse
                        )}
                      >
                        {dv.value}
                      </span>
                    </div>
                  ))}
                </div>
                <Badge
                  text={`${scenario.activeRules.size}/${totalRules}`}
                  color={
                    scenario.activeRules.size === totalRules
                      ? 'green'
                      : scenario.activeRules.size === 0
                        ? 'red'
                        : 'blue'
                  }
                />
              </div>
            </button>
          );
        })}
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
    }),
    empty: css({
      padding: theme.spacing(2),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,
    }),
    dimList: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    dimLabel: css({
      width: '100%',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(0.25),
    }),
    dimChip: css({
      display: 'inline-block',
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
    }),
    scenarioList: css({
      flex: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
    scenarioCount: css({
      display: 'block',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(0.5),
    }),
    scenarioItem: css({
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
    scenarioItemSelected: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
      '&:hover': {
        borderColor: theme.colors.primary.border,
        background: theme.colors.primary.transparent,
      },
    }),
    scenarioContent: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    }),
    scenarioDimensions: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
    }),
    scenarioDimRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.3,
    }),
    scenarioDimName: css({
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      '&::after': {
        content: '":"',
      },
    }),
    scenarioDimValue: css({
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
    }),
    dimValueTrue: css({
      color: theme.colors.success.text,
    }),
    dimValueFalse: css({
      color: theme.colors.text.primary,
    }),
  };
}
