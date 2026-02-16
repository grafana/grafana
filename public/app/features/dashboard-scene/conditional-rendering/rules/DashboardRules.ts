import { sceneGraph, SceneObjectBase, SceneObjectState, SceneRefreshPicker } from '@grafana/scenes';
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
  /**
   * Map of targetKey -> collapsed boolean, derived from active collapse rules.
   * Only applies to RowItem targets.
   */
  collapsedTargets: Record<string, boolean>;
  /**
   * Dashboard-level refresh interval override from the first matching
   * refresh interval outcome. undefined means no override is active.
   */
  refreshIntervalOverride?: string;
}

/**
 * Container for all dashboard-level rules. Lives on DashboardScene and provides
 * reactive visibility state for the rendering layer.
 *
 * Rules are evaluated in array order; the last matching rule wins
 * when multiple rules target the same element with conflicting visibility outcomes.
 */
export class DashboardRules extends SceneObjectBase<DashboardRulesState> {
  /** Original refresh interval to restore when override is removed. */
  private _originalRefreshInterval: string | undefined;

  public constructor(state: DashboardRulesState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    for (const rule of this.state.rules) {
      if (!rule.isActive) {
        this._subs.add(rule.activate());
      }

      // Subscribe to each rule's active state changes to recompute outcomes
      this._subs.add(
        rule.subscribeToState((newState, prevState) => {
          if (newState.active !== prevState.active) {
            this._recomputeOutcomes();
          }
        })
      );
    }

    this._recomputeOutcomes();
  }

  private _recomputeOutcomes() {
    const hiddenTargets: Record<string, boolean> = {};
    const collapsedTargets: Record<string, boolean> = {};
    let refreshIntervalOverride: string | undefined;

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
      const collapseOutcome = rule.getCollapseOutcome();
      const refreshOutcome = rule.getRefreshIntervalOutcome();

      for (const targetKey of rule.getTargetKeys()) {
        if (visibilityOutcome) {
          hiddenTargets[targetKey] = visibilityOutcome.spec.visibility === 'hide';
          console.debug('[DashboardRules] Setting hiddenTargets', targetKey, '=', hiddenTargets[targetKey]);
        }

        if (collapseOutcome) {
          collapsedTargets[targetKey] = collapseOutcome.spec.collapse;
          console.debug('[DashboardRules] Setting collapsedTargets', targetKey, '=', collapsedTargets[targetKey]);
        }
      }

      // Refresh interval is dashboard-global; first active rule wins
      if (refreshOutcome && refreshIntervalOverride === undefined) {
        refreshIntervalOverride = refreshOutcome.spec.interval;
        console.debug('[DashboardRules] Setting refreshIntervalOverride =', refreshIntervalOverride);
      }
    }

    console.debug('[DashboardRules] Final outcomes:', {
      hiddenTargets,
      collapsedTargets,
      refreshIntervalOverride,
    });

    const prevOverride = this.state.refreshIntervalOverride;
    this.setState({ hiddenTargets, collapsedTargets, refreshIntervalOverride });

    // Apply or revert refresh interval override on the SceneRefreshPicker
    if (refreshIntervalOverride !== prevOverride) {
      this._applyRefreshIntervalOverride(refreshIntervalOverride);
    }
  }

  /** Apply or revert the refresh interval on the SceneRefreshPicker. */
  private _applyRefreshIntervalOverride(interval: string | undefined) {
    const refreshPicker = this._getRefreshPicker();
    if (!refreshPicker) {
      return;
    }

    if (interval !== undefined) {
      // Save original interval before overriding (only if not already saved)
      if (this._originalRefreshInterval === undefined) {
        this._originalRefreshInterval = refreshPicker.state.refresh;
        console.debug('[DashboardRules] Saved original refresh interval =', this._originalRefreshInterval);
      }
      console.debug('[DashboardRules] Applying refresh interval override =', interval);
      // Use onIntervalChanged to both update state and restart the auto-refresh timer
      refreshPicker.onIntervalChanged(interval);
    } else if (this._originalRefreshInterval !== undefined) {
      // Revert to original interval and restart the timer
      console.debug('[DashboardRules] Reverting refresh interval to', this._originalRefreshInterval);
      refreshPicker.onIntervalChanged(this._originalRefreshInterval);
      this._originalRefreshInterval = undefined;
    }
  }

  /** Find the SceneRefreshPicker via the scene graph. */
  private _getRefreshPicker(): SceneRefreshPicker | undefined {
    try {
      const found = sceneGraph.findObject(this.getRoot(), (obj) => obj instanceof SceneRefreshPicker);
      return found instanceof SceneRefreshPicker ? found : undefined;
    } catch {
      return undefined;
    }
  }

  /** Add a new rule, activate it, and subscribe to its state changes. */
  public addRule(rule: DashboardRule) {
    if (!rule.isActive) {
      this._subs.add(rule.activate());
    }

    this._subs.add(
      rule.subscribeToState((newState, prevState) => {
        if (newState.active !== prevState.active) {
            this._recomputeOutcomes();
        }
      })
    );

    this.setState({ rules: [...this.state.rules, rule] });
    this._recomputeOutcomes();
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
          this._recomputeOutcomes();
        }
      })
    );

    this.setState({ rules });
    this._recomputeOutcomes();
  }

  /** Remove the rule at the given index and recompute. */
  public removeRule(index: number) {
    const rules = this.state.rules.filter((_, i) => i !== index);
    this.setState({ rules });
    this._recomputeOutcomes();
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
      collapsedTargets: {},
    });
  }
}
