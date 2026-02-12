import { Registry, RegistryItem } from '@grafana/data';
import { DashboardRuleOutcomeVisibilityKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/** Union of all outcome kind types from the dashboard schema. Grows with new outcome types. */
export type DashboardRuleOutcomeKindTypes = DashboardRuleOutcomeVisibilityKind;

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
export interface OutcomeRegistryItem<TSpec = unknown> extends RegistryItem {
  /** Extract the typed spec from a schema kind representation. */
  specFromKind(kind: DashboardRuleOutcomeKindTypes): TSpec;
  /** Serialize the typed spec back to its schema kind representation. */
  specToKind(spec: TSpec): DashboardRuleOutcomeKindTypes;
  /** Create default spec for a new outcome of this type. */
  createDefaultSpec(): TSpec;
  /** Optional React component for editing this outcome's spec. */
  Editor?: React.ComponentType<OutcomeEditorProps<TSpec>>;
}

export interface OutcomeEditorProps<TSpec = unknown> {
  spec: TSpec;
  onChange: (spec: TSpec) => void;
}

export const outcomeRegistry = new Registry<OutcomeRegistryItem>();
