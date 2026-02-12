import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { DashboardRuleKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardRule } from './DashboardRule';

export interface DashboardRulesState extends SceneObjectState {
  rules: DashboardRule[];
}

/**
 * Container for all dashboard-level rules. Lives on DashboardScene and provides
 * lookup methods for the rendering layer to query the effective state of each element.
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
    }
  }

  /** Get all rules that target a given element or layout item. */
  public getRulesForTarget(targetKey: string): DashboardRule[] {
    return this.state.rules.filter((rule) => rule.getTargetKey() === targetKey);
  }

  /**
   * Determine if a target should be hidden based on all active rules.
   * Rules are evaluated in array order; the last matching rule wins
   * when multiple rules target the same element with conflicting visibility outcomes.
   */
  public isTargetHidden(targetKey: string): boolean | undefined {
    const targetRules = this.getRulesForTarget(targetKey);
    let hidden: boolean | undefined;

    for (const rule of targetRules) {
      if (!rule.state.active) {
        continue;
      }

      const visibilityOutcome = rule.getVisibilityOutcome();
      if (visibilityOutcome) {
        hidden = visibilityOutcome.spec.visibility === 'hide';
      }
    }

    return hidden;
  }

  public serialize(): DashboardRuleKind[] {
    return this.state.rules.map((rule) => rule.serialize());
  }

  public static deserialize(models: DashboardRuleKind[]): DashboardRules {
    return new DashboardRules({
      rules: models.map((model) => DashboardRule.deserialize(model)),
    });
  }
}
