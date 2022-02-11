import { DataQuery } from '@grafana/data';
import { DashboardDataDTO, StoreState } from 'app/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { useSelector } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import { useCallback } from 'react';
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

const createDashboard = (dashboardName: string, folderId: number, queries: DataQuery[]) => {
  const dashboard = getDashboardSrv().create({ title: dashboardName }, { folderId });

  // TODO: type should be based on current visualization in explore
  dashboard.addPanel({ targets: queries, type: 'table' });

  return lastValueFrom(createDashboardApiCall(dashboard.getSaveModelClone(), folderId));
};

export const useAddToDashboard = () => {
  // TODO: left or right should be dynamic
  // TODO: move selector somewhere else
  const queries = useSelector((state: StoreState) => state.explore.left.queries);
  // to decide which panel to show we should pick the first refId from queries, then pick from graphFrames, logsFrame, traceFrames and nodeGraphFrames
  // in the store and the first one that matches refId
  //   const queries = useSelector((state: StoreState) => state.explore.left.sh);
  return useCallback(
    async (data: SaveToNewDashboardDTO | SaveToExistingDashboardDTO) => {
      // TODO: if create dashboard...
      // @ts-expect-error
      return await createDashboard(data.dashboardName, data.folder.id, queries);
    },
    [queries]
  );
};
