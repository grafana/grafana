import { DataQuery } from '@grafana/data';
import { DashboardDataDTO, ExploreId, StoreState } from 'app/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { useSelector } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import { useCallback, useMemo } from 'react';
import { getExploreItemSelector } from '../state/selectors';
export interface SaveToNewDashboardDTO {
  dashboardName: string;
  folder: { title: string; id: number };
}

export interface SaveToExistingDashboardDTO {
  dashboard: string;
}

const createDashboardApiCall = (dashboard: DashboardDataDTO, folderId: number) => {
  // TODO: properly type this
  return getBackendSrv().fetch<any>({
    url: '/api/dashboards/db/',
    method: 'POST',
    data: {
      dashboard,
      folderId,
    },
    showErrorAlert: false,
  });
};

const createDashboard = (dashboardName: string, folderId: number, queries: DataQuery[], visualization: string) => {
  const dashboard = getDashboardSrv().create({ title: dashboardName }, { folderId });

  // TODO: type should be based on current visualization in explore
  dashboard.addPanel({ targets: queries, type: visualization });

  return lastValueFrom(createDashboardApiCall(dashboard.getSaveModelClone(), folderId));
};

const isActive = (query: DataQuery) => !query.hide;

export const useAddToDashboard = (exploreId: ExploreId) => {
  const exploreSelector = useMemo(() => getExploreItemSelector(exploreId), [exploreId]);
  const queries = useSelector((state: StoreState) => exploreSelector(state)?.queries || []);
  const exploreFrames = useSelector((state: StoreState) => {
    const exploreState = exploreSelector(state);
    return {
      graphFrames: exploreState?.queryResponse.graphFrames,
      logsFrames: exploreState?.queryResponse.logsFrames,
      traceFrames: exploreState?.queryResponse.traceFrames,
      nodeGraphFrames: exploreState?.queryResponse.nodeGraphFrames,
      tableFrames: exploreState?.queryResponse.tableFrames,
    };
  });

  return useCallback(
    async (data: SaveToNewDashboardDTO | SaveToExistingDashboardDTO) => {
      const activeQueries = queries.filter(isActive);
      // to decide which panel to show we should pick the first refId from queries, then pick from graphFrames, logsFrames, traceFrames and nodeGraphFrames
      // in the store and the first one that matches refId
      let visualization = 'table';
      // TODO: tidy this up, check for panel names and if they are available in dashboards
      for (const { refId } of activeQueries) {
        if (exploreFrames.graphFrames?.some((frame) => frame.refId === refId)) {
          visualization = 'graph';
          break;
        }
        if (exploreFrames.logsFrames?.some((frame) => frame.refId === refId)) {
          visualization = 'logs';
          break;
        }
        if (exploreFrames.nodeGraphFrames?.some((frame) => frame.refId === refId)) {
          visualization = 'node-graph';
          break;
        }
        if (exploreFrames.traceFrames?.some((frame) => frame.refId === refId)) {
          visualization = 'trace';
          break;
        }
      }

      // TODO: if create dashboard...
      return await createDashboard(data.dashboardName, data.folder.id, queries, visualization);
    },
    // FIXME: this will recompute on every render
    [queries, exploreFrames]
  );
};
