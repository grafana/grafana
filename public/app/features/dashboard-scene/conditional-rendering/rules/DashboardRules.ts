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
      if (!rule.state.active) {
        continue;
      }

      const targetKey = rule.getTargetKey();
      const visibilityOutcome = rule.getVisibilityOutcome();

      if (visibilityOutcome) {
        hiddenTargets[targetKey] = visibilityOutcome.spec.visibility === 'hide';
      }
    }

    this.setState({ hiddenTargets });
  }

  /** Get all rules that target a given element or layout item. */
  public getRulesForTarget(targetKey: string): DashboardRule[] {
    return this.state.rules.filter((rule) => rule.getTargetKey() === targetKey);
  }

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
