import { Unsubscribable } from 'rxjs';

import { DEFAULT_APPLICABILITY_KEY, DrilldownsApplicability } from '@grafana/data';
import {
  AdHocFiltersVariable,
  findClosestAdHocFilterInHierarchy,
  SceneObjectBase,
  SceneObjectState,
  sceneGraph,
  SceneDataQuery,
} from '@grafana/scenes';

import { getDataSourceSrv } from '@grafana/runtime';
import { debounce } from 'lodash';

import { getQueryRunnerFor } from '../utils/utils';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';

import { DashboardScene } from './DashboardScene';

interface ApplicabilityGroup {
  adhocVar: AdHocFiltersVariable;
  dsUid: string;
  panelQueries: Map<string, SceneDataQuery[]>;
}

export interface ApplicabilityManagerState extends SceneObjectState {
  results: Map<string, DrilldownsApplicability[]>;
}

export class ApplicabilityManager extends SceneObjectBase<ApplicabilityManagerState> {
  private _adhocSubs: Unsubscribable[] = [];
  private _bodySub?: Unsubscribable;
  private _groups = new Map<string, ApplicabilityGroup>();
  private _lastPanelKeys = new Set<string>();

  public constructor() {
    super({ results: new Map() });
    this.addActivationHandler(this._onActivate);
  }

  private _debouncedResolveForAdhoc = debounce((adhocVar: AdHocFiltersVariable) => {
    this.resolveForAdhoc(adhocVar);
  }, 250);

  private _debouncedResolveAll = debounce(() => {
    this.resolveAll();
  }, 250);

  private _onActivate = () => {
    this.resolveAll();
    this.subscribeToDashboardBodyChanges();

    return () => {
      this._adhocSubs.forEach((sub) => sub.unsubscribe());
      this._adhocSubs = [];
      this._bodySub?.unsubscribe();
      this._bodySub = undefined;
      this._debouncedResolveForAdhoc.cancel();
      this._debouncedResolveAll.cancel();
      this._groups.clear();
      this._lastPanelKeys.clear();
    };
  };

  private getDashboard(): DashboardScene {
    const parent = this.parent;
    if (!(parent instanceof DashboardScene)) {
      throw new Error('ApplicabilityManager must be attached to a DashboardScene');
    }
    return parent;
  }

  private buildGroups(): Map<string, ApplicabilityGroup> {
    const dashboard = this.getDashboard();
    const groups = new Map<string, ApplicabilityGroup>();
    const panels = dashboard.state.body.getVizPanels();

    for (const panel of panels) {
      const sqr = getQueryRunnerFor(panel);
      if (!sqr) {
        continue;
      }

      const dsRef = getDatasourceFromQueryRunner(sqr);
      const dsUid = sceneGraph.interpolate(panel, dsRef?.uid);
      if (!dsUid) {
        continue;
      }

      const adhocVar = findClosestAdHocFilterInHierarchy(dsUid, panel);
      if (!adhocVar) {
        continue;
      }

      const groupKey = `${adhocVar.state.name}|${dsUid}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = { adhocVar, dsUid, panelQueries: new Map() };
        groups.set(groupKey, group);
      }
      group.panelQueries.set(panel.state.key!, sqr.state.queries);
    }

    return groups;
  }

  private getPanelKeys(): Set<string> {
    const panels = this.getDashboard().state.body.getVizPanels();
    return new Set(panels.map((p) => p.state.key!));
  }

  private hasPanelSetChanged(): boolean {
    const currentKeys = this.getPanelKeys();
    if (currentKeys.size !== this._lastPanelKeys.size) {
      return true;
    }
    for (const key of currentKeys) {
      if (!this._lastPanelKeys.has(key)) {
        return true;
      }
    }
    return false;
  }

  private subscribeToDashboardBodyChanges() {
    this._bodySub?.unsubscribe();

    const dashboard = this.getDashboard();

    const bodySub = dashboard.state.body.subscribeToState(() => {
      if (this.hasPanelSetChanged()) {
        this._debouncedResolveAll();
      }
    });

    this._bodySub = {
      unsubscribe: () => {
        bodySub.unsubscribe();
      },
    };
  }

  private subscribeToAdhocChanges() {
    this._adhocSubs.forEach((sub) => sub.unsubscribe());
    this._adhocSubs = [];

    const subscribedVars = new Set<AdHocFiltersVariable>();

    for (const group of this._groups.values()) {
      if (subscribedVars.has(group.adhocVar)) {
        continue;
      }
      subscribedVars.add(group.adhocVar);

      const adhocVar = group.adhocVar;
      const sub = adhocVar.subscribeToState((newState, prevState) => {
        if (newState.filters !== prevState.filters || newState.originFilters !== prevState.originFilters) {
          this._debouncedResolveForAdhoc(adhocVar);
        }
      });

      this._adhocSubs.push(sub);
    }
  }

  private async resolveGroups(groups: ApplicabilityGroup[]): Promise<Map<string, DrilldownsApplicability[]>> {
    const results = new Map<string, DrilldownsApplicability[]>();

    const promises = groups.map(async (group) => {
      const filters = [...(group.adhocVar.state.originFilters ?? []), ...group.adhocVar.state.filters];

      if (filters.length === 0) {
        for (const panelKey of group.panelQueries.keys()) {
          results.set(panelKey, []);
        }
        return;
      }

      try {
        const ds = await getDataSourceSrv().get({ uid: group.dsUid });
        if (!ds.getDrilldownsApplicability) {
          return;
        }

        const timeRange = sceneGraph.getTimeRange(this.getDashboard()).state.value;
        const scopes = sceneGraph.getScopes(this.getDashboard());

        const resultMap = await ds.getDrilldownsApplicability({
          filters,
          panelQueries: group.panelQueries,
          timeRange,
          scopes,
        });

        for (const [panelKey, applicability] of resultMap) {
          results.set(panelKey, applicability);
        }
      } catch (error) {
        console.error('ApplicabilityManager: failed to resolve applicability for group', error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  public async resolveAll() {
    this._groups = this.buildGroups();
    this._lastPanelKeys = this.getPanelKeys();
    this.subscribeToAdhocChanges();

    const results = await this.resolveGroups(Array.from(this._groups.values()));
    this.setState({ results });
  }

  public async resolveForAdhoc(adhocVar: AdHocFiltersVariable) {
    const affectedGroups = Array.from(this._groups.values()).filter((g) => g.adhocVar === adhocVar);
    if (affectedGroups.length === 0) {
      return;
    }

    const updatedResults = await this.resolveGroups(affectedGroups);

    const newResults = new Map(this.state.results);
    for (const [panelKey, applicability] of updatedResults) {
      newResults.set(panelKey, applicability);
    }
    this.setState({ results: newResults });
  }

  public async refreshForPanel(panelKey: string, queries: SceneDataQuery[]) {
    const dashboard = this.getDashboard();
    const panel = dashboard.state.body.getVizPanels().find((p) => p.state.key === panelKey);
    if (!panel) {
      return;
    }

    const sqr = getQueryRunnerFor(panel);
    if (!sqr) {
      return;
    }

    const dsRef = getDatasourceFromQueryRunner(sqr);
    const dsUid = sceneGraph.interpolate(panel, dsRef?.uid);
    if (!dsUid) {
      return;
    }

    const adhocVar = findClosestAdHocFilterInHierarchy(dsUid, panel);
    if (!adhocVar) {
      return;
    }

    const filters = [...(adhocVar.state.originFilters ?? []), ...adhocVar.state.filters];

    if (filters.length === 0) {
      const newResults = new Map(this.state.results);
      newResults.set(panelKey, []);
      this.setState({ results: newResults });
      return;
    }

    try {
      const ds = await getDataSourceSrv().get({ uid: dsUid });
      if (!ds.getDrilldownsApplicability) {
        return;
      }

      const timeRange = sceneGraph.getTimeRange(dashboard).state.value;
      const scopes = sceneGraph.getScopes(dashboard);

      const resultMap = await ds.getDrilldownsApplicability({
        filters,
        queries,
        timeRange,
        scopes,
      });

      const panelResults = resultMap.get(DEFAULT_APPLICABILITY_KEY);
      if (panelResults) {
        const newResults = new Map(this.state.results);
        newResults.set(panelKey, panelResults);
        this.setState({ results: newResults });
      }
    } catch (error) {
      console.error('ApplicabilityManager: failed to refresh applicability for panel', panelKey, error);
    }
  }
}
