import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { ElementReference, LayoutItemReference } from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';
import { Badge, Button, IconButton, Select, useStyles2 } from '@grafana/ui';

import { conditionRegistry } from '../conditional-rendering/conditions/conditionRegistry';
import '../conditional-rendering/conditions/serializers';
import { ConditionalRenderingConditions } from '../conditional-rendering/conditions/types';
import { outcomeRegistry, DashboardRuleOutcomeKindTypes } from '../conditional-rendering/outcomes/outcomeRegistry';
import '../conditional-rendering/outcomes/outcomeRegistryInit';
import { DashboardRule, RuleTarget } from '../conditional-rendering/rules/DashboardRule';
import { DashboardRules } from '../conditional-rendering/rules/DashboardRules';
import { DashboardEditActionEvent } from '../edit-pane/shared';
import { DashboardScene } from '../scene/DashboardScene';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

interface Props {
  dashboard: DashboardScene;
}

// ---------------------------------------------------------------------------
// Team name resolution
// ---------------------------------------------------------------------------

type TeamNameMap = Map<string, string>;

function useTeamNames(rules: DashboardRule[]): TeamNameMap {
  const [teamNames, setTeamNames] = useState<TeamNameMap>(new Map());
  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const res = await getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 });
        if (!cancelled) {
          const m = new Map<string, string>();
          for (const t of res.teams ?? []) {
            m.set(t.uid, t.name);
          }
          setTeamNames(m);
        }
      } catch {
        /* ignore */
      }
    }
    fetch();
    return () => {
      cancelled = true;
    };
  }, [rules]);
  return teamNames;
}

// ---------------------------------------------------------------------------
// Target helpers
// ---------------------------------------------------------------------------

interface TargetOption {
  label: string;
  value: string;
  target: ElementReference | LayoutItemReference;
}

function getAvailableTargets(dashboard: DashboardScene): TargetOption[] {
  const targets: TargetOption[] = [];
  const body = dashboard.state.body;
  for (const panel of body.getVizPanels()) {
    const id = dashboardSceneGraph.getElementIdentifierForVizPanel(panel);
    targets.push({
      label: `Panel: ${panel.state.title || id}`,
      value: `element:${id}`,
      target: { kind: 'ElementReference', name: id },
    });
  }
  collectLayoutItems(body, targets);
  return targets;
}

function collectLayoutItems(layout: unknown, targets: TargetOption[]) {
  if (layout instanceof RowsLayoutManager) {
    for (const [idx, row] of layout.state.rows.entries()) {
      const name = row.state.name || `row-${idx}`;
      if (!row.state.name) {
        row.setState({ name });
      }
      targets.push({
        label: `Row: ${row.state.title || name}`,
        value: `layout:${name}`,
        target: { kind: 'LayoutItemReference', name },
      });
    }
  }
  if (layout instanceof TabsLayoutManager) {
    for (const [idx, tab] of layout.state.tabs.entries()) {
      const name = tab.state.name || `tab-${idx}`;
      if (!tab.state.name) {
        tab.setState({ name });
      }
      targets.push({
        label: `Tab: ${tab.state.title || name}`,
        value: `layout:${name}`,
        target: { kind: 'LayoutItemReference', name },
      });
      collectLayoutItems(tab.getLayout(), targets);
    }
  }
}

// ---------------------------------------------------------------------------
// NL description helpers
// ---------------------------------------------------------------------------

function describeCondition(
  serialized: { kind: string; spec: Record<string, unknown> } | { kind: string; spec: unknown },
  teamNames: TeamNameMap
): string {
  const spec = serialized.spec as Record<string, unknown>;
  switch (serialized.kind) {
    case 'ConditionalRenderingTimeRangeSize':
      return `time range < ${spec.value}`;
    case 'ConditionalRenderingUserTeam': {
      const op = spec.operator as string;
      const uids = (spec.teamUids as string[] | undefined) ?? [];
      const names = uids.map((uid) => teamNames.get(uid) ?? uid).join(', ');
      return op === 'is_member' ? `user is member of ${names}` : `user is not in ${names}`;
    }
    case 'ConditionalRenderingVariable': {
      const { variable, operator, value } = spec;
      return `$${variable} ${operator} ${value}`;
    }
    case 'ConditionalRenderingData':
      return spec.value ? 'panel has data' : 'panel has no data';
    default:
      return serialized.kind;
  }
}

function describeOutcome(outcome: DashboardRuleOutcomeKindTypes): string {
  switch (outcome.kind) {
    case 'DashboardRuleOutcomeVisibility':
      return outcome.spec.visibility === 'hide' ? 'hide element' : 'show element';
    case 'DashboardRuleOutcomeCollapse':
      return outcome.spec.collapse ? 'collapse row' : 'expand row';
    case 'DashboardRuleOutcomeRefreshInterval':
      return `set refresh to ${outcome.spec.interval}`;
    case 'DashboardRuleOutcomeOverrideQuery':
      return 'override queries';
    default: {
      const exhaustive: never = outcome;
      return String((exhaustive as DashboardRuleOutcomeKindTypes).kind);
    }
  }
}

function describeTarget(target: RuleTarget): string {
  const name = target.name.replace(/^(panel-|row-|tab-)/, '').replace(/-/g, ' ');
  if (target.kind === 'ElementReference') {
    return `panel "${name}"`;
  }
  const kind = target.name.startsWith('row-') ? 'row' : target.name.startsWith('tab-') ? 'tab' : 'element';
  return `${kind} "${name}"`;
}

// ---------------------------------------------------------------------------
// Sentence segment types
// ---------------------------------------------------------------------------

interface SentenceSegment {
  text: string;
  kind: 'keyword' | 'condition' | 'outcome' | 'target' | 'connector';
}

function buildSentence(rule: DashboardRule, teamNames: TeamNameMap): SentenceSegment[] {
  const segs: SentenceSegment[] = [];
  segs.push({ text: 'IF', kind: 'keyword' });
  for (let i = 0; i < rule.state.conditions.length; i++) {
    if (i > 0) {
      segs.push({ text: rule.state.match === 'and' ? 'AND' : 'OR', kind: 'connector' });
    }
    segs.push({ text: describeCondition(rule.state.conditions[i].serialize(), teamNames), kind: 'condition' });
  }
  if (rule.state.conditions.length === 0) {
    segs.push({ text: 'always', kind: 'condition' });
  }
  segs.push({ text: 'THEN', kind: 'keyword' });
  for (let i = 0; i < rule.state.outcomes.length; i++) {
    if (i > 0) {
      segs.push({ text: 'and', kind: 'connector' });
    }
    segs.push({ text: describeOutcome(rule.state.outcomes[i]), kind: 'outcome' });
  }
  if (rule.state.targets.length > 0) {
    segs.push({ text: 'ON', kind: 'keyword' });
    for (let i = 0; i < rule.state.targets.length; i++) {
      if (i > 0) {
        segs.push({ text: ',', kind: 'connector' });
      }
      segs.push({ text: describeTarget(rule.state.targets[i]), kind: 'target' });
    }
  }
  return segs;
}

// ---------------------------------------------------------------------------
// Interactive sentence builder state
// ---------------------------------------------------------------------------

interface ConditionSlot {
  id: number;
  type: string | null;
  instance: ConditionalRenderingConditions | null;
}

interface OutcomeSlot {
  id: number;
  type: string | null;
  spec: DashboardRuleOutcomeKindTypes | null;
}

const EMPTY_RULES: DashboardRule[] = [];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RulesBuilderView({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { dashboardRules } = dashboard.useState();
  const rulesState = dashboardRules?.useState();
  const rules = rulesState?.rules ?? EMPTY_RULES;
  const teamNames = useTeamNames(rules);

  return (
    <div className={styles.container}>
      {/* Left sidebar: existing rules */}
      {rules.length > 0 && (
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Rules ({rules.length})</span>
          </div>
          <div className={styles.sidebarScroll}>
            {rules.map((rule, index) => (
              <ExistingRuleCard key={index} rule={rule} index={index} teamNames={teamNames} dashboard={dashboard} />
            ))}
          </div>
        </div>
      )}

      {/* Main area: sentence builder centered */}
      <div className={styles.mainArea}>
        <SentenceBuilder dashboard={dashboard} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Existing rule card (read-only sentence)
// ---------------------------------------------------------------------------

function ExistingRuleCard({
  rule,
  index,
  teamNames,
  dashboard,
}: {
  rule: DashboardRule;
  index: number;
  teamNames: TeamNameMap;
  dashboard: DashboardScene;
}) {
  const styles = useStyles2(getStyles);
  const { active, name } = rule.useState();
  const segments = useMemo(() => buildSentence(rule, teamNames), [rule, teamNames]);

  return (
    <div className={cx(styles.card, active && styles.cardActive)}>
      <div className={styles.cardHeader}>
        <span className={cx(styles.dot, active ? styles.dotActive : styles.dotInactive)} />
        <span className={styles.cardName}>{name ?? `Rule ${index + 1}`}</span>
        <Badge text={active ? 'Active' : 'Inactive'} color={active ? 'green' : 'red'} />
        <IconButton
          name="trash-alt"
          size="sm"
          tooltip="Delete rule"
          onClick={() => dashboard.state.dashboardRules?.removeRule(index)}
        />
      </div>
      <div className={styles.sentenceRow}>
        {segments.map((seg, i) => (
          <span key={i} className={cx(styles.pill, styles[`pill_${seg.kind}`])}>
            {seg.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive sentence builder
// ---------------------------------------------------------------------------

export function SentenceBuilder({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const targets = useMemo(() => getAvailableTargets(dashboard), [dashboard]);

  const conditionOptions = useMemo<Array<SelectableValue<string>>>(
    () => conditionRegistry.list().map((item) => ({ label: item.name, value: item.id, description: item.description })),
    []
  );
  const outcomeOptions = useMemo<Array<SelectableValue<string>>>(
    () => outcomeRegistry.list().map((item) => ({ label: item.name, value: item.id, description: item.description })),
    []
  );
  const targetOptions = useMemo<Array<SelectableValue<string>>>(
    () => targets.map((t) => ({ label: t.label, value: t.value })),
    [targets]
  );

  // Conditions
  const [conditions, setConditions] = useState<ConditionSlot[]>([]);
  const [match, setMatch] = useState<'and' | 'or'>('and');
  const nextCondId = useRef(0);

  // Outcomes
  const [outcomes, setOutcomes] = useState<OutcomeSlot[]>([]);
  const nextOutId = useRef(0);

  // Targets
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // Handle condition editor dispatches
  useEffect(() => {
    const sub = dashboard.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
      const isOurs = conditions.some((c) => c.instance === payload.source);
      if (isOurs) {
        payload.perform();
      }
    });
    return () => sub.unsubscribe();
  }, [dashboard, conditions]);

  const addCondition = useCallback(() => {
    const id = nextCondId.current++;
    setConditions((prev) => [...prev, { id, type: null, instance: null }]);
  }, []);

  const pickConditionType = useCallback(
    (slotId: number, type: string) => {
      const item = conditionRegistry.get(type);
      const instance = item.createEmpty(dashboard);
      (instance as any)._parent = dashboard; // eslint-disable-line @typescript-eslint/no-explicit-any
      setConditions((prev) => prev.map((c) => (c.id === slotId ? { ...c, type, instance } : c)));
    },
    [dashboard]
  );

  const removeCondition = useCallback((slotId: number) => {
    setConditions((prev) => prev.filter((c) => c.id !== slotId));
  }, []);

  const addOutcome = useCallback(() => {
    const id = nextOutId.current++;
    setOutcomes((prev) => [...prev, { id, type: null, spec: null }]);
  }, []);

  const pickOutcomeType = useCallback((slotId: number, type: string) => {
    const item = outcomeRegistry.get(type);
    const defaultSpec = item.createDefaultSpec();
    const kind = item.specToKind(defaultSpec);
    setOutcomes((prev) => prev.map((o) => (o.id === slotId ? { ...o, type, spec: kind } : o)));
  }, []);

  const updateOutcome = useCallback((slotId: number, spec: DashboardRuleOutcomeKindTypes) => {
    setOutcomes((prev) => prev.map((o) => (o.id === slotId ? { ...o, spec } : o)));
  }, []);

  const removeOutcome = useCallback((slotId: number) => {
    setOutcomes((prev) => prev.filter((o) => o.id !== slotId));
  }, []);

  const addTarget = useCallback((value: string) => {
    setSelectedTargets((prev) => (prev.includes(value) ? prev : [...prev, value]));
  }, []);

  const removeTarget = useCallback((value: string) => {
    setSelectedTargets((prev) => prev.filter((v) => v !== value));
  }, []);

  // Check if all outcomes are global (no target needed)
  const requiresTargets =
    outcomes.length === 0 ||
    outcomes.some((o) => {
      if (!o.type) {
        return true;
      }
      const item = outcomeRegistry.getIfExists(o.type);
      return item ? item.targetKinds.length > 0 : true;
    });

  const validConditions = conditions.filter((c) => c.instance !== null);
  const validOutcomes = outcomes.filter((o) => o.spec !== null);
  const canCreate = validOutcomes.length > 0 && (selectedTargets.length > 0 || !requiresTargets);

  const handleCreate = () => {
    const resolvedTargets = selectedTargets
      .map((v) => targets.find((t) => t.value === v))
      .filter((t): t is TargetOption => t !== undefined);

    const rule = new DashboardRule({
      targets: resolvedTargets.map((t) => t.target),
      match,
      conditions: validConditions.map((c) => c.instance!),
      outcomes: validOutcomes.map((o) => o.spec!),
      active: false,
    });

    let dashRules = dashboard.state.dashboardRules;
    if (dashRules) {
      dashRules.addRule(rule);
    } else {
      dashRules = new DashboardRules({
        rules: [rule],
        hiddenTargets: {},
        collapsedTargets: {},
      });
      dashboard.setState({ dashboardRules: dashRules });
    }

    // Reset
    setConditions([]);
    setOutcomes([]);
    setSelectedTargets([]);
  };

  return (
    <div className={styles.builderContainer}>
      {/* Horizontal sentence */}
      <div className={styles.sentenceBuilder}>
        <span className={cx(styles.pill, styles.pill_keyword)}>IF</span>

        {conditions.length === 0 && (
          <button className={styles.addSlotButton} onClick={addCondition}>
            + condition
          </button>
        )}

        {conditions.map((slot, idx) => (
          <div key={slot.id} className={styles.slotRow}>
            {idx > 0 && (
              <button
                className={cx(styles.pill, styles.pill_connector, styles.pillClickable)}
                onClick={() => setMatch(match === 'and' ? 'or' : 'and')}
              >
                {match === 'and' ? 'AND' : 'OR'}
              </button>
            )}

            {slot.type === null ? (
              <div className={styles.inlinePicker}>
                <Select
                  options={conditionOptions}
                  onChange={(v) => v.value && pickConditionType(slot.id, v.value)}
                  placeholder="pick a condition..."
                  autoFocus
                  openMenuOnFocus
                  width={26}
                />
              </div>
            ) : (
              <ConditionSlotEditor slot={slot} onRemove={() => removeCondition(slot.id)} />
            )}
          </div>
        ))}

        {conditions.length > 0 && (
          <button className={styles.addSlotInline} onClick={addCondition}>
            +
          </button>
        )}

        <span className={cx(styles.pill, styles.pill_keyword)}>THEN</span>

        {outcomes.length === 0 && (
          <button className={styles.addSlotButton} onClick={addOutcome}>
            + outcome
          </button>
        )}

        {outcomes.map((slot, idx) => (
          <div key={slot.id} className={styles.slotRow}>
            {idx > 0 && <span className={cx(styles.pill, styles.pill_connector)}>and</span>}

            {slot.type === null ? (
              <div className={styles.inlinePicker}>
                <Select
                  options={outcomeOptions}
                  onChange={(v) => v.value && pickOutcomeType(slot.id, v.value)}
                  placeholder="pick an outcome..."
                  autoFocus
                  openMenuOnFocus
                  width={26}
                />
              </div>
            ) : (
              <OutcomeSlotEditor
                slot={slot}
                dashboard={dashboard}
                selectedTargets={selectedTargets}
                onUpdate={(spec) => updateOutcome(slot.id, spec)}
                onRemove={() => removeOutcome(slot.id)}
              />
            )}
          </div>
        ))}

        {outcomes.length > 0 && (
          <button className={styles.addSlotInline} onClick={addOutcome}>
            +
          </button>
        )}

        {requiresTargets && (
          <>
            <span className={cx(styles.pill, styles.pill_keyword)}>ON</span>

            {selectedTargets.map((value) => {
              const opt = targets.find((t) => t.value === value);
              return (
                <span key={value} className={cx(styles.pill, styles.pill_target)}>
                  {opt?.label ?? value}
                  <IconButton
                    name="times"
                    size="xs"
                    tooltip="Remove target"
                    onClick={() => removeTarget(value)}
                    className={styles.pillRemove}
                  />
                </span>
              );
            })}

            <div className={styles.inlinePicker}>
              <Select
                options={targetOptions.filter((o) => !selectedTargets.includes(String(o.value)))}
                onChange={(v) => v.value && addTarget(String(v.value))}
                placeholder={selectedTargets.length === 0 ? 'pick a target...' : 'add another...'}
                value={null}
                width={24}
              />
            </div>
          </>
        )}

        <Button variant="primary" size="sm" onClick={handleCreate} disabled={!canCreate}>
          Create rule
        </Button>
      </div>

      {!canCreate && validOutcomes.length === 0 && (
        <span className={styles.hint}>Pick at least one outcome to create a rule</span>
      )}
      {!canCreate && validOutcomes.length > 0 && selectedTargets.length === 0 && requiresTargets && (
        <span className={styles.hint}>Pick at least one target to create a rule</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition slot editor (inline condition config)
// ---------------------------------------------------------------------------

function ConditionSlotEditor({ slot, onRemove }: { slot: ConditionSlot; onRemove: () => void }) {
  const styles = useStyles2(getStyles);

  const ConditionComponent = slot.instance
    ? (slot.instance.constructor as { Component?: React.ComponentType<{ model: ConditionalRenderingConditions }> })
        .Component
    : undefined;

  return (
    <div className={styles.slotEditor}>
      <div className={styles.slotEditorHeader}>
        <span className={cx(styles.pill, styles.pill_condition)}>{conditionRegistry.get(slot.type!).name}</span>
        <IconButton name="times" size="xs" tooltip="Remove" onClick={onRemove} />
      </div>
      {ConditionComponent && slot.instance && (
        <div className={styles.slotEditorBody}>
          <ConditionComponent model={slot.instance} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outcome slot editor (inline outcome config)
// ---------------------------------------------------------------------------

function OutcomeSlotEditor({
  slot,
  dashboard,
  selectedTargets,
  onUpdate,
  onRemove,
}: {
  slot: OutcomeSlot;
  dashboard: DashboardScene;
  selectedTargets: string[];
  onUpdate: (spec: DashboardRuleOutcomeKindTypes) => void;
  onRemove: () => void;
}) {
  const styles = useStyles2(getStyles);
  const registryItem = outcomeRegistry.get(slot.type!);
  const Editor = registryItem.Editor;
  const spec = slot.spec ? registryItem.specFromKind(slot.spec) : undefined;

  return (
    <div className={styles.slotEditor}>
      <div className={styles.slotEditorHeader}>
        <span className={cx(styles.pill, styles.pill_outcome)}>{registryItem.name}</span>
        <IconButton name="times" size="xs" tooltip="Remove" onClick={onRemove} />
      </div>
      {Editor && spec !== undefined && (
        <div className={styles.slotEditorBody}>
          <Editor
            spec={spec}
            onChange={(newSpec) => onUpdate(registryItem.specToKind(newSpec))}
            dashboard={dashboard}
            selectedTargets={selectedTargets}
          />
        </div>
      )}
      {/* Visibility outcome: inline show/hide */}
      {slot.spec?.kind === 'DashboardRuleOutcomeVisibility' && (
        <div className={styles.slotEditorBody}>
          <div className={styles.inlineToggleRow}>
            <button
              className={cx(styles.toggleBtn, slot.spec.spec.visibility === 'hide' && styles.toggleBtnActive)}
              onClick={() => onUpdate({ kind: 'DashboardRuleOutcomeVisibility', spec: { visibility: 'hide' } })}
            >
              Hide
            </button>
            <button
              className={cx(styles.toggleBtn, slot.spec.spec.visibility === 'show' && styles.toggleBtnActive)}
              onClick={() => onUpdate({ kind: 'DashboardRuleOutcomeVisibility', spec: { visibility: 'show' } })}
            >
              Show
            </button>
          </div>
        </div>
      )}
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
      flexDirection: 'row',
      flex: 1,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    }),

    // Left sidebar
    sidebar: css({
      display: 'flex',
      flexDirection: 'column',
      width: 340,
      minWidth: 260,
      flexShrink: 0,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    sidebarHeader: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
    }),
    sidebarTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,
    }),
    sidebarScroll: css({
      flex: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),

    // Main area
    mainArea: css({
      flex: 1,
      display: 'grid',
      placeItems: 'center',
      overflow: 'auto',
      padding: theme.spacing(2),
      minWidth: 0,
      minHeight: 0,
    }),

    // Existing rule card
    card: css({
      padding: theme.spacing(1.5),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
    }),
    cardActive: css({
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.success.main,
    }),
    cardHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      marginBottom: theme.spacing(0.75),
    }),
    cardName: css({
      flex: 1,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    dot: css({
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
    }),
    dotActive: css({ background: theme.colors.success.main }),
    dotInactive: css({ background: theme.colors.text.disabled }),

    sentenceRow: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      lineHeight: 2,
    }),

    // Pills
    pill: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
    }),
    pill_keyword: css({
      background: 'transparent',
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '0.05em',
      padding: theme.spacing(0.25, 0.25),
    }),
    pill_condition: css({
      background: theme.colors.info.transparent,
      color: theme.colors.info.text,
      border: `1px solid ${theme.colors.info.border}`,
    }),
    pill_outcome: css({
      background: theme.colors.warning.transparent,
      color: theme.colors.warning.text,
      border: `1px solid ${theme.colors.warning.border}`,
    }),
    pill_target: css({
      background: theme.colors.success.transparent,
      color: theme.colors.success.text,
      border: `1px solid ${theme.colors.success.border}`,
    }),
    pill_connector: css({
      background: 'transparent',
      color: theme.colors.text.secondary,
      padding: theme.spacing(0.25, 0.25),
    }),
    pillClickable: css({
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
        textDecoration: 'underline',
      },
    }),
    pillRemove: css({
      marginLeft: theme.spacing(0.25),
    }),

    // Builder container
    builderContainer: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(0.75),
    }),

    // Sentence builder -- single horizontal wrapping line
    sentenceBuilder: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      lineHeight: 2.2,
    }),
    slotRow: css({
      display: 'inline-flex',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
    }),
    addSlotButton: css({
      display: 'inline-flex',
      alignItems: 'center',
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      border: `1px dashed ${theme.colors.border.medium}`,
      background: 'transparent',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      '&:hover': {
        borderColor: theme.colors.primary.border,
        color: theme.colors.primary.text,
        background: theme.colors.primary.transparent,
      },
    }),
    addSlotInline: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      borderRadius: '50%',
      border: `1px dashed ${theme.colors.border.medium}`,
      background: 'transparent',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      cursor: 'pointer',
      alignSelf: 'center',
      '&:hover': {
        borderColor: theme.colors.primary.border,
        color: theme.colors.primary.text,
        background: theme.colors.primary.transparent,
      },
    }),
    inlinePicker: css({
      display: 'inline-flex',
      alignItems: 'center',
    }),

    // Slot editor (expanded config)
    slotEditor: css({
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      overflow: 'hidden',
    }),
    slotEditorHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.5, 0.75),
    }),
    slotEditorBody: css({
      padding: theme.spacing(0.75, 1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      // Hide wrapper chrome from condition editors (alerts, delete buttons)
      '& [role="alert"]': { display: 'none' },
      '& button[aria-label*="Delete"]': { display: 'none' },
    }),

    // Inline toggle
    inlineToggleRow: css({
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    toggleBtn: css({
      padding: theme.spacing(0.25, 1),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      background: 'transparent',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      '&:hover': {
        borderColor: theme.colors.primary.border,
      },
    }),
    toggleBtnActive: css({
      background: theme.colors.primary.transparent,
      borderColor: theme.colors.primary.border,
      color: theme.colors.primary.text,
    }),

    hint: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
  };
}
