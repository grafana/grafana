import { Unsubscribable } from 'rxjs';

import { Scope, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  getQueriesForVariables,
} from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';

interface RecommendedDrilldownsBehaviorState extends SceneObjectState {
  enableRecommendations?: boolean;
}

export class RecommendedDrilldownsBehavior extends SceneObjectBase<RecommendedDrilldownsBehaviorState> {
  private _dashboardScene: DashboardScene | undefined;

  private _adHocVar?: AdHocFiltersVariable;
  private _groupByVar?: GroupByVariable;

  private _adHocSub?: Unsubscribable;
  private _groupBySub?: Unsubscribable;

  constructor(state: RecommendedDrilldownsBehaviorState) {
    super(state);

    this.addActivationHandler(() => {
      if (!this.state.enableRecommendations) {
        return;
      }

      this._dashboardScene = sceneGraph.getAncestor(this, DashboardScene);

      if (!this._dashboardScene || !this._dashboardScene.state.uid) {
        return;
      }

      const variables = sceneGraph.getVariables(this);

      this._adHocVar = variables.state.variables.find((v) => v instanceof AdHocFiltersVariable);
      this._groupByVar = variables.state.variables.find((v) => v instanceof GroupByVariable);

      const scopes = sceneGraph.getScopes(this);
      const timeRange = sceneGraph.getTimeRange(this).state.value;
      const dashboardUid = this._dashboardScene?.state.uid;

      this._subs.add(
        variables.subscribeToState((n) => {
          this._adHocVar = n.variables.find((variable) => variable instanceof AdHocFiltersVariable);
          this._groupByVar = n.variables.find((variable) => variable instanceof GroupByVariable);

          if (this._adHocVar) {
            this._adHocSub?.unsubscribe();
            this._adHocSub = this._adHocVar?.subscribeToState((n, p) => {
              if (n.filters !== p.filters || n.originFilters !== p.originFilters) {
                this.getRecommendedDrilldowns(scopes, timeRange, dashboardUid);
              }
            });
          }

          if (this._groupByVar) {
            this._groupBySub?.unsubscribe();
            this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
              if (n.value !== p.value) {
                this.getRecommendedDrilldowns(scopes, timeRange, dashboardUid);
              }
            });
          }

          this.getRecommendedDrilldowns(scopes, timeRange, dashboardUid);
        })
      );

      this._adHocSub = this._adHocVar?.subscribeToState((n, p) => {
        if (n.filters !== p.filters || n.originFilters !== p.originFilters) {
          this.getRecommendedDrilldowns(scopes, timeRange, dashboardUid);
        }
      });

      this._groupBySub = this._groupByVar?.subscribeToState((n, p) => {
        if (n.value !== p.value) {
          this.getRecommendedDrilldowns(scopes, timeRange, dashboardUid);
        }
      });

      this.getRecommendedDrilldowns(scopes, timeRange, dashboardUid);

      return () => {
        this._groupBySub?.unsubscribe();
        this._adHocSub?.unsubscribe();
      };
    });
  }

  private async getRecommendedDrilldowns(
    scopes: Scope[] | undefined,
    timeRange: TimeRange,
    dashboardUid: string | undefined
  ) {
    const drilldownsVariable = this._adHocVar || this._groupByVar;

    if (!drilldownsVariable) {
      return;
    }

    const ds = await getDataSourceSrv().get(drilldownsVariable.state.datasource?.uid);

    if (!ds.getRecommendedDrilldowns) {
      return;
    }

    const queries = getQueriesForVariables(drilldownsVariable);

    const filters = [...(this._adHocVar?.state.originFilters ?? []), ...(this._adHocVar?.state.filters ?? [])];
    const groupByKeys = Array.isArray(this._groupByVar?.state.value)
      ? this._groupByVar.state.value.map((v) => String(v))
      : this._groupByVar?.state.value
        ? [String(this._groupByVar.state.value)]
        : [];

    const recommendedDrilldowns = await ds.getRecommendedDrilldowns({
      timeRange,
      dashboardUid,
      queries,
      filters,
      groupByKeys,
      scopes,
    });

    if (this._adHocVar && recommendedDrilldowns.filters) {
      this._adHocVar.setRecommendedFilters(recommendedDrilldowns.filters);
    }

    if (this._groupByVar && recommendedDrilldowns.groupByKeys) {
      this._groupByVar.setRecommendedGrouping(recommendedDrilldowns.groupByKeys);
    }
  }
}
