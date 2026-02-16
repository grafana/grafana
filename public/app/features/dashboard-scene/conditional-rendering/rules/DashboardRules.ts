import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DashboardRuleKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardRule } from './DashboardRule';

export interface DashboardRulesState extends SceneObjectState {
  rules: DashboardRule[];
  /**
   * Map of targetKey -> hidden boolean, derived from active rules.
   * Updated whenever any rule's active state changes. undefined means
   * no rule applies to that target (use default behavior).
   */
  hiddenTargets: Record<string, boolean>;
}

/**
 * Container for all dashboard-level rules. Lives on DashboardScene and provides
 * reactive visibility state for the rendering layer.
 *
 * Rules are evaluated in array order; the last matching rule wins
 * when multiple rules target the same element with conflicting visibility outcomes.
 */
export class DashboardRules extends SceneObjectBase<DashboardRulesState> {
  public constructor(state: DashboardRulesState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    for (const rule of this.state.rules) {
      if (!rule.isActive) {
        this._subs.add(rule.activate());
      }

      // Subscribe to each rule's active state changes to recompute hiddenTargets
      this._subs.add(
        rule.subscribeToState((newState, prevState) => {
          if (newState.active !== prevState.active) {
            this._recomputeHiddenTargets();
          }
        })
      );
    }

    this._recomputeHiddenTargets();
  }

  private _recomputeHiddenTargets() {
    const hiddenTargets: Record<string, boolean> = {};

    // Evaluate rules in array order; last matching rule wins for each target
    for (const rule of this.state.rules) {
      console.debug('[DashboardRules] Checking rule', {
        name: rule.state.name,
        active: rule.state.active,
        targets: rule.getTargetKeys(),
        outcomes: rule.state.outcomes,
      });

      if (!rule.state.active) {
        continue;
      }

      const visibilityOutcome = rule.getVisibilityOutcome();

      if (visibilityOutcome) {
        for (const targetKey of rule.getTargetKeys()) {
          hiddenTargets[targetKey] = visibilityOutcome.spec.visibility === 'hide';
          console.debug('[DashboardRules] Setting hiddenTargets', targetKey, '=', hiddenTargets[targetKey]);
        }
      }
    }

    console.debug('[DashboardRules] Final hiddenTargets:', JSON.stringify(hiddenTargets));
    this.setState({ hiddenTargets });
  }

  /** Add a new rule, activate it, and subscribe to its state changes. */
  public addRule(rule: DashboardRule) {
    if (!rule.isActive) {
      this._subs.add(rule.activate());
    }

    this._subs.add(
      rule.subscribeToState((newState, prevState) => {
        if (newState.active !== prevState.active) {
          this._recomputeHiddenTargets();
        }
      })
    );

    this.setState({ rules: [...this.state.rules, rule] });
    this._recomputeHiddenTargets();
  }

  /** Replace the rule at the given index with a new rule, activate it, and recompute. */
  public updateRule(index: number, rule: DashboardRule) {
    const rules = [...this.state.rules];
    rules[index] = rule;

    if (!rule.isActive) {
      this._subs.add(rule.activate());
    }

    this._subs.add(
      rule.subscribeToState((newState, prevState) => {
        if (newState.active !== prevState.active) {
          this._recomputeHiddenTargets();
        }
      })
    );

    this.setState({ rules });
    this._recomputeHiddenTargets();
  }

  /** Remove the rule at the given index and recompute. */
  public removeRule(index: number) {
    const rules = this.state.rules.filter((_, i) => i !== index);
    this.setState({ rules });
    this._recomputeHiddenTargets();
  }

  /** Get all rules that target a given element or layout item. */
  public getRulesForTarget(targetKey: string): DashboardRule[] {
    return this.state.rules.filter((rule) => rule.getTargetKeys().includes(targetKey));
  }

  /** Serialize all rules to schema format. */
  public serialize(): DashboardRuleKind[] {
    return this.state.rules.map((rule) => rule.serialize());
  }

  public static deserialize(models: DashboardRuleKind[]): DashboardRules {
    return new DashboardRules({
      rules: models.map((model) => DashboardRule.deserialize(model)),
      hiddenTargets: {},
    });
  }
}
