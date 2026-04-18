import { DataQuery } from '@grafana/data';
import {
  sceneGraph,
  SceneDataQuery,
  SceneDataTransformer,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneRefreshPicker,
  VizPanel,
} from '@grafana/scenes';
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
  /** Original queries for panels overridden by the override query outcome, keyed by target key. */
  private _originalQueries: Map<string, SceneDataQuery[]> = new Map();

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
    // Tracks which targets should have their queries overridden and with what
    const queryOverrides: Map<string, Record<string, any>[]> = new Map();

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
      const overrideQueryOutcome = rule.getOverrideQueryOutcome();

      for (const targetKey of rule.getTargetKeys()) {
        if (visibilityOutcome) {
          hiddenTargets[targetKey] = visibilityOutcome.spec.visibility === 'hide';
          console.debug('[DashboardRules] Setting hiddenTargets', targetKey, '=', hiddenTargets[targetKey]);
        }

        if (collapseOutcome) {
          collapsedTargets[targetKey] = collapseOutcome.spec.collapse;
          console.debug('[DashboardRules] Setting collapsedTargets', targetKey, '=', collapsedTargets[targetKey]);
        }

        if (overrideQueryOutcome && overrideQueryOutcome.spec.queries.length > 0) {
          queryOverrides.set(targetKey, overrideQueryOutcome.spec.queries);
          console.debug('[DashboardRules] Setting queryOverride for', targetKey);
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
      queryOverrides: Array.from(queryOverrides.keys()),
    });

    const prevOverride = this.state.refreshIntervalOverride;
    this.setState({ hiddenTargets, collapsedTargets, refreshIntervalOverride });

    // Apply or revert refresh interval override on the SceneRefreshPicker
    if (refreshIntervalOverride !== prevOverride) {
      this._applyRefreshIntervalOverride(refreshIntervalOverride);
    }

    // Apply or revert query overrides on target panels
    this._applyQueryOverrides(queryOverrides);
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

  /** Apply or revert query overrides for target panels. */
  private _applyQueryOverrides(activeOverrides: Map<string, Record<string, any>[]>) {
    // Revert panels that no longer have active overrides
    for (const [targetKey, originalQueries] of this._originalQueries) {
      if (!activeOverrides.has(targetKey)) {
        const queryRunner = this._getQueryRunnerForTarget(targetKey);
        if (queryRunner) {
          console.debug('[DashboardRules] Reverting query override for', targetKey);
          queryRunner.setState({ queries: originalQueries });
          queryRunner.runQueries();
        }
        this._originalQueries.delete(targetKey);
      }
    }

    // Apply new or updated overrides
    for (const [targetKey, overrideQueries] of activeOverrides) {
      const queryRunner = this._getQueryRunnerForTarget(targetKey);
      if (!queryRunner) {
        console.debug('[DashboardRules] Could not find query runner for target', targetKey);
        continue;
      }

      // Save originals before first override
      if (!this._originalQueries.has(targetKey)) {
        this._originalQueries.set(targetKey, [...queryRunner.state.queries]);
        console.debug('[DashboardRules] Saved original queries for', targetKey);
      }

      // Convert the opaque query objects to SceneDataQuery, preserving the
      // original panel datasource so the override doesn't change the DS.
      const originalDatasource = queryRunner.state.datasource ?? queryRunner.state.queries[0]?.datasource;
      const newQueries: SceneDataQuery[] = overrideQueries.map((q, i) => ({
        ...q,
        refId: (q as DataQuery).refId || String.fromCharCode(65 + i),
        datasource: originalDatasource,
      }));

      console.debug('[DashboardRules] Applying query override for', targetKey, newQueries);
      queryRunner.setState({ queries: newQueries });
      queryRunner.runQueries();
    }
  }

  /** Find the SceneQueryRunner for a panel target key (element:xxx). */
  private _getQueryRunnerForTarget(targetKey: string): SceneQueryRunner | undefined {
    if (!targetKey.startsWith('element:')) {
      return undefined;
    }

    const elementId = targetKey.slice('element:'.length);

    try {
      const root = this.getRoot();

      // Use the serializer to map element name -> numeric panel ID -> VizPanel key.
      // We access the serializer via 'any' to avoid circular imports with DashboardScene.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serializer = (root as any)?.serializer;
      let vizPanelKey = elementId;
      if (serializer?.getPanelIdForElement) {
        const numericId = serializer.getPanelIdForElement(elementId);
        if (numericId !== undefined) {
          vizPanelKey = `panel-${numericId}`;
        }
      }

      const allPanels = sceneGraph.findAllObjects(root, (obj) => obj instanceof VizPanel);
      console.debug('[DashboardRules] _getQueryRunnerForTarget', {
        elementId,
        vizPanelKey,
        allPanelKeys: allPanels.map((p) => p.state.key),
      });
      const panel = allPanels.find((obj) => obj.state.key === vizPanelKey);

      if (!panel) {
        console.debug('[DashboardRules] No panel found for key', vizPanelKey);
        return undefined;
      }

      const data = sceneGraph.getData(panel);
      console.debug('[DashboardRules] Panel data provider type:', data?.constructor?.name);
      // Panels wrap SceneQueryRunner in SceneDataTransformer
      if (data instanceof SceneDataTransformer) {
        const inner = data.state.$data;
        return inner instanceof SceneQueryRunner ? inner : undefined;
      }
      return data instanceof SceneQueryRunner ? data : undefined;
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
