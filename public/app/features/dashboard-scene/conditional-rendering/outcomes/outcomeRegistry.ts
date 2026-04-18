import { Registry, RegistryItem } from '@grafana/data';
import type { SceneObject } from '@grafana/scenes';
import {
  DashboardRuleOutcomeCollapseKind,
  DashboardRuleOutcomeOverrideQueryKind,
  DashboardRuleOutcomeRefreshIntervalKind,
  DashboardRuleOutcomeVisibilityKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';

/** Union of all outcome kind types from the dashboard schema. Grows with new outcome types. */
export type DashboardRuleOutcomeKindTypes =
  | DashboardRuleOutcomeVisibilityKind
  | DashboardRuleOutcomeCollapseKind
  | DashboardRuleOutcomeRefreshIntervalKind
  | DashboardRuleOutcomeOverrideQueryKind;

/** Element kinds an outcome can target. Empty array means dashboard-global (no targets needed). */
export type OutcomeTargetKind = 'panel' | 'row' | 'tab';

/**
 * Defines an outcome type that can be registered in the outcome registry.
 * Outcomes are non-destructive: when conditions stop being met, the target
 * reverts to its original state. The rule engine (DashboardRule) handles
 * the apply/revert lifecycle; this interface covers schema integration
 * and editor components.
 *
 * New outcome types (e.g. "switch visualization", "alternate query") can be added
 * by registering an OutcomeRegistryItem without modifying core rules code.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OutcomeRegistryItem<TSpec = any> extends RegistryItem {
  /**
   * Which element kinds this outcome can target.
   * Empty array means dashboard-global -- no targets are required.
   */
  targetKinds: OutcomeTargetKind[];
  /** Extract the typed spec from a schema kind representation. */
  specFromKind(kind: DashboardRuleOutcomeKindTypes): TSpec;
  /** Serialize the typed spec back to its schema kind representation. */
  specToKind(spec: TSpec): DashboardRuleOutcomeKindTypes;
  /** Create default spec for a new outcome of this type. */
  createDefaultSpec(): TSpec;
  /** Optional React component for editing this outcome's spec. */
  Editor?: React.ComponentType<OutcomeEditorProps<TSpec>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OutcomeEditorProps<TSpec = any> {
  spec: TSpec;
  onChange: (spec: TSpec) => void;
  /** Dashboard context -- available for editors that need scene graph access (e.g. query editor). */
  dashboard?: SceneObject;
  /** Currently selected target keys (e.g. "panel-1", "row-myrow"). */
  selectedTargets?: string[];
}

export const outcomeRegistry = new Registry<OutcomeRegistryItem>();
