import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ElementReference, LayoutItemReference } from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';
import {
  Button,
  ComboboxOption,
  Field,
  IconButton,
  Input,
  MultiCombobox,
  RadioButtonGroup,
  Select,
  Stack,
  useStyles2,
} from '@grafana/ui';

import { conditionRegistry } from '../conditional-rendering/conditions/conditionRegistry';
import '../conditional-rendering/conditions/serializers'; // side-effect: populates conditionRegistry
import { DashboardRule } from '../conditional-rendering/rules/DashboardRule';
import { ConditionalRenderingConditions } from '../conditional-rendering/conditions/types';
import { DashboardEditActionEvent } from '../edit-pane/shared';
import { outcomeRegistry, DashboardRuleOutcomeKindTypes } from '../conditional-rendering/outcomes/outcomeRegistry';
import '../conditional-rendering/outcomes/outcomeRegistryInit'; // side-effect: populates outcomeRegistry
import { DashboardRules } from '../conditional-rendering/rules/DashboardRules';
import { DashboardScene } from '../scene/DashboardScene';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

interface Props {
  dashboard: DashboardScene;
  onClose: () => void;
  /** When set, the form operates in edit mode for the rule at this index. */
  editRuleIndex?: number;
}

interface TargetOption extends ComboboxOption<string> {
  target: ElementReference | LayoutItemReference;
}

interface ConditionEntry {
  id: number;
  type: string;
  instance: ConditionalRenderingConditions;
}

interface OutcomeEntry {
  id: number;
  type: string;
  spec: DashboardRuleOutcomeKindTypes;
}

export function AddRuleForm({ dashboard, onClose, editRuleIndex }: Props) {
  const styles = useStyles2(getStyles);
  const isEditMode = editRuleIndex !== undefined;
  const existingRule = isEditMode ? dashboard.state.dashboardRules?.state.rules[editRuleIndex] : undefined;

  // Initialize state from existing rule when editing
  const [name, setName] = useState(() => existingRule?.state.name ?? '');
  const [selectedTargetValues, setSelectedTargetValues] = useState<string[]>(() => {
    if (!existingRule) {
      return [];
    }
    return existingRule.getTargetKeys();
  });
  const [match, setMatch] = useState<'and' | 'or'>(() => existingRule?.state.match ?? 'and');

  // Multiple conditions -- seed from existing rule when editing
  const [conditions, setConditions] = useState<ConditionEntry[]>(() => {
    if (!existingRule) {
      return [];
    }
    return existingRule.state.conditions.map((instance, idx) => ({
      id: idx,
      type: instance.serialize().kind,
      instance,
    }));
  });
  const nextConditionId = useRef(existingRule?.state.conditions.length ?? 0);
  const [addingCondition, setAddingCondition] = useState(false);

  // Multiple outcomes -- seed from existing rule when editing
  const [outcomes, setOutcomes] = useState<OutcomeEntry[]>(() => {
    if (!existingRule) {
      return [];
    }
    return existingRule.state.outcomes.map((spec, idx) => ({
      id: idx,
      type: spec.kind,
      spec,
    }));
  });
  const nextOutcomeId = useRef(existingRule?.state.outcomes.length ?? 0);
  const [addingOutcome, setAddingOutcome] = useState(false);

  const targets = useMemo(() => getAvailableTargets(dashboard), [dashboard]);
  const conditionOptions = useMemo(() => getConditionOptions(), []);
  const outcomeOptions = useMemo(() => getOutcomeOptions(), []);

  // The condition editors dispatch changes through DashboardEditActionEvent (undo/redo system).
  // In the settings view the DashboardEditPane may not be active, so we handle
  // events from our transient conditions directly to ensure edits take effect.
  useEffect(() => {
    const sub = dashboard.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
      const isOurCondition = conditions.some((c) => c.instance === payload.source);
      if (isOurCondition) {
        payload.perform();
      }
    });
    return () => sub.unsubscribe();
  }, [dashboard, conditions]);

  const resolvedTargets = selectedTargetValues
    .map((v) => targets.find((t) => t.value === v))
    .filter((t): t is TargetOption => t !== undefined);

  // Check whether targets are needed based on the selected outcomes.
  // If every outcome is dashboard-global (targetKinds === []), targets are optional.
  const requiresTargets =
    outcomes.length === 0 ||
    outcomes.some((o) => {
      const item = outcomeRegistry.getIfExists(o.type);
      return item ? item.targetKinds.length > 0 : true;
    });

  const canSubmit = outcomes.length > 0 && (resolvedTargets.length > 0 || !requiresTargets);

  const handleAddCondition = useCallback(
    (option: SelectableValue<string>) => {
      const type = option.value;
      if (!type) {
        return;
      }

      const registryItem = conditionRegistry.get(type);
      const instance = registryItem.createEmpty(dashboard);
      // Attach to the dashboard so scene graph traversal (getDashboardSceneFor) works.
      (instance as any)._parent = dashboard; // eslint-disable-line @typescript-eslint/no-explicit-any

      const id = nextConditionId.current++;
      setConditions((prev) => [...prev, { id, type, instance }]);
      setAddingCondition(false);
    },
    [dashboard]
  );

  const handleRemoveCondition = useCallback((id: number) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleAddOutcome = useCallback((option: SelectableValue<string>) => {
    const type = option.value;
    if (!type) {
      return;
    }

    const registryItem = outcomeRegistry.get(type);
    const defaultSpec = registryItem.createDefaultSpec();
    const kind = registryItem.specToKind(defaultSpec);

    const id = nextOutcomeId.current++;
    setOutcomes((prev) => [...prev, { id, type, spec: kind }]);
    setAddingOutcome(false);
  }, []);

  const handleUpdateOutcome = useCallback((id: number, updatedSpec: DashboardRuleOutcomeKindTypes) => {
    setOutcomes((prev) => prev.map((o) => (o.id === id ? { ...o, spec: updatedSpec } : o)));
  }, []);

  const handleRemoveOutcome = useCallback((id: number) => {
    setOutcomes((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const handleDelete = () => {
    if (isEditMode && dashboard.state.dashboardRules) {
      dashboard.state.dashboardRules.removeRule(editRuleIndex);
    }
    onClose();
  };

  const handleSubmit = () => {
    if (resolvedTargets.length === 0 || outcomes.length === 0) {
      return;
    }

    const rule = new DashboardRule({
      name: name || undefined,
      targets: resolvedTargets.map((t) => t.target),
      match,
      conditions: conditions.map((c) => c.instance),
      outcomes: outcomes.map((o) => o.spec),
      active: false,
    });

    let dashboardRules = dashboard.state.dashboardRules;

    if (isEditMode && dashboardRules) {
      dashboardRules.updateRule(editRuleIndex, rule);
    } else if (dashboardRules) {
      dashboardRules.addRule(rule);
    } else {
      dashboardRules = new DashboardRules({
        rules: [rule],
        hiddenTargets: {},
        collapsedTargets: {},
      });
      dashboard.setState({ dashboardRules });
    }

    onClose();
  };

  return (
    <div className={styles.form}>
      <Stack direction="column" gap={2}>
        <Field label="Rule name (optional)">
          <Input placeholder="e.g. Hide when no data" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        </Field>

        <Field label="Match conditions">
          <RadioButtonGroup
            options={[
              { label: 'All (AND)', value: 'and' as const },
              { label: 'Any (OR)', value: 'or' as const },
            ]}
            value={match}
            onChange={(v) => setMatch(v)}
          />
        </Field>

        {/* Conditions list */}
        <Field label="Conditions" description="Conditions that must be met for outcomes to apply">
          <Stack direction="column" gap={1}>
            {conditions.map((entry) => (
              <ConditionItem key={entry.id} entry={entry} onRemove={handleRemoveCondition} styles={styles} />
            ))}

            {addingCondition ? (
              <Stack direction="row" gap={1} alignItems="center">
                <div style={{ flex: 1 }}>
                  <Select
                    options={conditionOptions}
                    onChange={handleAddCondition}
                    placeholder="Select condition type..."
                    autoFocus
                    openMenuOnFocus
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => setAddingCondition(false)}>
                  Cancel
                </Button>
              </Stack>
            ) : (
              <Button variant="secondary" icon="plus" size="sm" onClick={() => setAddingCondition(true)}>
                Add condition
              </Button>
            )}
          </Stack>
        </Field>

        {/* Outcomes list */}
        <Field label="Outcomes" description="What happens when conditions are met">
          <Stack direction="column" gap={1}>
            {outcomes.map((entry) => (
              <OutcomeItem
                key={entry.id}
                entry={entry}
                onUpdate={handleUpdateOutcome}
                onRemove={handleRemoveOutcome}
                dashboard={dashboard}
                selectedTargets={selectedTargetValues}
                styles={styles}
              />
            ))}

            {addingOutcome ? (
              <Stack direction="row" gap={1} alignItems="center">
                <div style={{ flex: 1 }}>
                  <Select
                    options={outcomeOptions}
                    onChange={handleAddOutcome}
                    placeholder="Select outcome type..."
                    autoFocus
                    openMenuOnFocus
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => setAddingOutcome(false)}>
                  Cancel
                </Button>
              </Stack>
            ) : (
              <Button variant="secondary" icon="plus" size="sm" onClick={() => setAddingOutcome(true)}>
                Add outcome
              </Button>
            )}
          </Stack>
        </Field>

        {requiresTargets && (
          <Field label="Targets" description="The panels, rows, or tabs this rule applies to">
            <MultiCombobox
              options={targets}
              value={selectedTargetValues}
              onChange={(options) => setSelectedTargetValues(options.map((o) => String(o.value)))}
              placeholder="Select targets..."
              width="auto"
              minWidth={32}
            />
          </Field>
        )}

        <Stack direction="row" gap={1} justifyContent="flex-end">
          {isEditMode && (
            <Button variant="destructive" fill="outline" onClick={handleDelete}>
              Delete rule
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {isEditMode ? 'Save rule' : 'Add rule'}
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

/** Renders a single condition entry with its inline editor and remove button. */
function ConditionItem({
  entry,
  onRemove,
  styles,
}: {
  entry: ConditionEntry;
  onRemove: (id: number) => void;
  styles: ReturnType<typeof getStyles>;
}) {
  const ConditionEditor = (
    entry.instance.constructor as {
      Component?: React.ComponentType<{ model: ConditionalRenderingConditions }>;
    }
  ).Component;

  return (
    <div className={styles.conditionEditor}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <div style={{ flex: 1 }}>
          {ConditionEditor ? <ConditionEditor model={entry.instance} /> : <span>{entry.type}</span>}
        </div>
        <IconButton name="trash-alt" size="sm" onClick={() => onRemove(entry.id)} tooltip="Remove condition" />
      </Stack>
    </div>
  );
}

/** Renders a single outcome entry with its inline editor and remove button. */
function OutcomeItem({
  entry,
  onUpdate,
  onRemove,
  dashboard,
  selectedTargets,
  styles,
}: {
  entry: OutcomeEntry;
  onUpdate: (id: number, spec: DashboardRuleOutcomeKindTypes) => void;
  onRemove: (id: number) => void;
  dashboard: DashboardScene;
  selectedTargets: string[];
  styles: ReturnType<typeof getStyles>;
}) {
  const registryItem = outcomeRegistry.get(entry.type);

  // For the visibility outcome, render a simple show/hide radio
  if (entry.spec.kind === 'DashboardRuleOutcomeVisibility') {
    const visibility = entry.spec.spec.visibility;
    return (
      <div className={styles.outcomeEditor}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="column" gap={0.5}>
            <span className={styles.outcomeLabel}>{registryItem.name}</span>
            <RadioButtonGroup
              options={[
                { label: 'Hide element', value: 'hide' as const },
                { label: 'Show element', value: 'show' as const },
              ]}
              value={visibility}
              onChange={(v) =>
                onUpdate(entry.id, {
                  kind: 'DashboardRuleOutcomeVisibility',
                  spec: { visibility: v },
                })
              }
            />
          </Stack>
          <IconButton name="trash-alt" size="sm" onClick={() => onRemove(entry.id)} tooltip="Remove outcome" />
        </Stack>
      </div>
    );
  }

  // Generic fallback for future outcome types with an Editor component
  const EditorComponent = registryItem.Editor;
  const spec = registryItem.specFromKind(entry.spec);

  return (
    <div className={styles.outcomeEditor}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <div style={{ flex: 1 }}>
          <span className={styles.outcomeLabel}>{registryItem.name}</span>
          {EditorComponent && (
            <EditorComponent
              spec={spec}
              onChange={(newSpec) => onUpdate(entry.id, registryItem.specToKind(newSpec))}
              dashboard={dashboard}
              selectedTargets={selectedTargets}
            />
          )}
        </div>
        <IconButton name="trash-alt" size="sm" onClick={() => onRemove(entry.id)} tooltip="Remove outcome" />
      </Stack>
    </div>
  );
}

// ─── Target discovery ──────────────────────────────────────────────

function getAvailableTargets(dashboard: DashboardScene): TargetOption[] {
  const targets: TargetOption[] = [];
  const body = dashboard.state.body;

  // Panels (works for any layout manager via the common getVizPanels interface)
  const panels = body.getVizPanels();
  for (const panel of panels) {
    const elementId = dashboardSceneGraph.getElementIdentifierForVizPanel(panel);
    const title = panel.state.title || elementId;

    targets.push({
      label: `Panel: ${title}`,
      value: `element:${elementId}`,
      target: { kind: 'ElementReference', name: elementId },
    });
  }

  // Collect rows and tabs by walking the layout tree
  collectLayoutItems(body, targets);

  return targets;
}

/** Recursively walk layout managers to find all rows and tabs. */
function collectLayoutItems(layout: unknown, targets: TargetOption[]) {
  if (layout instanceof RowsLayoutManager) {
    for (const [idx, row] of layout.state.rows.entries()) {
      addRowTarget(row, idx, targets);
    }
  }

  if (layout instanceof TabsLayoutManager) {
    for (const [idx, tab] of layout.state.tabs.entries()) {
      addTabTarget(tab, idx, targets);
      // Tabs contain a nested layout that may hold rows
      collectLayoutItems(tab.getLayout(), targets);
    }
  }
}

function addRowTarget(row: RowItem, index: number, targets: TargetOption[]) {
  // Auto-generate a stable name if the row doesn't have one
  const rowName = ensureRowName(row, index);
  const title = row.state.title || rowName;

  targets.push({
    label: `Row: ${title}`,
    value: `layout:${rowName}`,
    target: { kind: 'LayoutItemReference', name: rowName },
  });
}

function addTabTarget(tab: TabItem, index: number, targets: TargetOption[]) {
  // Auto-generate a stable name if the tab doesn't have one
  const tabName = ensureTabName(tab, index);
  const title = tab.state.title || tabName;

  targets.push({
    label: `Tab: ${title}`,
    value: `layout:${tabName}`,
    target: { kind: 'LayoutItemReference', name: tabName },
  });
}

/** Ensure the row has a stable `name` for rule references. Assigns one if missing. */
function ensureRowName(row: RowItem, index: number): string {
  if (row.state.name) {
    return row.state.name;
  }
  const generatedName = `row-${index}`;
  row.setState({ name: generatedName });
  return generatedName;
}

/** Ensure the tab has a stable `name` for rule references. Assigns one if missing. */
function ensureTabName(tab: TabItem, index: number): string {
  if (tab.state.name) {
    return tab.state.name;
  }
  const generatedName = `tab-${index}`;
  tab.setState({ name: generatedName });
  return generatedName;
}

// ─── Registry helpers ──────────────────────────────────────────────

function getConditionOptions(): Array<SelectableValue<string>> {
  return conditionRegistry.list().map((item) => ({
    label: item.name,
    value: item.id,
    description: item.description,
  }));
}

function getOutcomeOptions(): Array<SelectableValue<string>> {
  return outcomeRegistry.list().map((item) => ({
    label: item.name,
    value: item.id,
    description: item.description,
  }));
}

// ─── Styles ────────────────────────────────────────────────────────

function getStyles(theme: GrafanaTheme2) {
  return {
    form: css({
      padding: theme.spacing(2),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      minWidth: 400,
      maxWidth: 480,
    }),
    conditionEditor: css({
      padding: theme.spacing(1.5),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      // When rendering condition editors standalone (outside the per-element context),
      // the ConditionalRenderingConditionWrapper's "not supported" alert and delete
      // button are not relevant. Hide them so the form shows only the configuration inputs.
      '& [role="alert"]': { display: 'none' },
      '& button[aria-label*="Delete"]': { display: 'none' },
    }),
    outcomeEditor: css({
      padding: theme.spacing(1.5),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    outcomeLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      display: 'block',
      marginBottom: theme.spacing(0.5),
    }),
  };
}
