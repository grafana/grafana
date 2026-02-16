import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import {
  DashboardRuleConditionsSpec,
  DashboardRuleKind,
  DashboardRuleOutcomeVisibilityKind,
  ElementReference,
  LayoutItemReference,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { conditionRegistry } from '../conditions/conditionRegistry';
import '../conditions/serializers'; // side-effect: populates conditionRegistry
import { ConditionalRenderingConditions } from '../conditions/types';
import { outcomeRegistry } from '../outcomes/outcomeRegistry';
import '../outcomes/outcomeRegistryInit'; // side-effect: populates outcomeRegistry
import { DashboardRuleOutcomeKindTypes } from '../outcomes/outcomeRegistry';

export type RuleTarget = ElementReference | LayoutItemReference;

export interface DashboardRuleState extends SceneObjectState {
  /** Optional human-readable name for this rule. */
  name?: string;
  /** The elements or layout items this rule targets. */
  targets: RuleTarget[];
  /** How to combine conditions: "and" requires all, "or" requires any. */
  match: 'and' | 'or';
  /** Condition SceneObjects that evaluate to boolean results. */
  conditions: ConditionalRenderingConditions[];
  /** Serialized outcomes to apply when conditions are met. */
  outcomes: DashboardRuleOutcomeKindTypes[];
  /** Whether all conditions are currently met (the rule is "active"). */
  active: boolean;
}

/**
 * A single dashboard-level rule. Evaluates conditions using AND/OR logic
 * and exposes an `active` boolean. The DashboardRules container uses this
 * to apply/revert outcomes on the target element.
 */
export class DashboardRule extends SceneObjectBase<DashboardRuleState> {
  public constructor(state: DashboardRuleState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    // Activate child conditions
    for (const condition of this.state.conditions) {
      if (!condition.isActive) {
        this._subs.add(condition.activate());
      }
    }

    // Subscribe to each condition's state changes to re-evaluate
    for (const condition of this.state.conditions) {
      this._subs.add(
        condition.subscribeToState(() => {
          this._evaluate();
        })
      );
    }

    // Initial evaluation
    this._evaluate();
  }

  private _evaluate() {
    const validConditions = this.state.conditions.filter((c) => c.state.result !== undefined);

    let active = true;

    if (validConditions.length > 0) {
      active =
        this.state.match === 'and'
          ? validConditions.every((c) => c.state.result)
          : validConditions.some((c) => c.state.result);
    }

    console.debug('[DashboardRule] _evaluate', {
      name: this.state.name,
      match: this.state.match,
      conditionResults: this.state.conditions.map((c) => ({
        kind: (c as any).constructor?.name,
        result: c.state.result,
      })),
      validConditionCount: validConditions.length,
      active,
      prevActive: this.state.active,
      targets: this.getTargetKeys(),
    });

    if (active !== this.state.active) {
      this.setState({ active });
    }
  }

  /** Returns target reference keys for indexing. */
  public getTargetKeys(): string[] {
    return this._getTargets().map((t) =>
      t.kind === 'LayoutItemReference' ? `layout:${t.name}` : `element:${t.name}`
    );
  }

  /** Backwards-compat accessor: older rules may still have singular `target`. */
  private _getTargets(): RuleTarget[] {
    return this.state.targets ?? ((this.state as any).target ? [(this.state as any).target] : []);
  }

  /** Check if this rule has a visibility outcome. */
  public getVisibilityOutcome(): DashboardRuleOutcomeVisibilityKind | undefined {
    return this.state.outcomes.find(
      (o): o is DashboardRuleOutcomeVisibilityKind => o.kind === 'DashboardRuleOutcomeVisibility'
    );
  }

  /** Serialize this rule into a single schema DashboardRuleKind with a targets array. */
  public serialize(): DashboardRuleKind {
    const conditionsSpec = {
      match: this.state.match,
      items: this.state.conditions.map((c) => c.serialize()),
    };
    const outcomesSpec = this.state.outcomes.map((o) => {
      const item = outcomeRegistry.get(o.kind);
      const spec = item.specFromKind(o);
      return item.specToKind(spec);
    });

    return {
      kind: 'DashboardRule' as const,
      spec: {
        name: this.state.name,
        targets: this._getTargets(),
        conditions: conditionsSpec,
        outcomes: outcomesSpec,
      },
    };
  }

  /** Deserialize a schema rule into a DashboardRule. */
  public static deserialize(model: DashboardRuleKind): DashboardRule {
    const conditions = deserializeConditions(model.spec.conditions);
    // Support both new `targets` array and legacy singular `target`
    const targets = (model.spec as any).targets ?? ((model.spec as any).target ? [(model.spec as any).target] : []);

    return new DashboardRule({
      name: model.spec.name,
      targets,
      match: model.spec.conditions.match,
      conditions,
      outcomes: model.spec.outcomes,
      active: false,
    });
  }
}

function deserializeConditions(conditionsSpec: DashboardRuleConditionsSpec): ConditionalRenderingConditions[] {
  return conditionsSpec.items.map((item) => conditionRegistry.get(item.kind).deserialize(item));
}
