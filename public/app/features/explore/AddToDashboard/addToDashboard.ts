import { DataFrame, DataQuery, DataSourceRef } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  getNewDashboardModelData,
  setDashboardToFetchFromLocalStorage,
} from 'app/features/dashboard/state/initDashboard';
import { ExplorePanelData } from 'app/types';

interface AddPanelToDashboardOptions {
  queries: DataQuery[];
  queryResponse: ExplorePanelData;
  datasource?: DataSourceRef;
  dashboardUid?: string;
}

function createDashboard() {
  const dto = getNewDashboardModelData();

  // getNewDashboardModelData adds by default the "add-panel" panel. We don't want that.
  dto.dashboard.panels = [];

  return dto;
}

export async function addPanelToDashboard(options: AddPanelToDashboardOptions) {
  const panelType = getPanelType(options.queries, options.queryResponse);
  const panel = {
    targets: options.queries,
    type: panelType,
    title: 'New Panel',
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    datasource: options.datasource,
  };

  const dto = options.dashboardUid ? await backendSrv.getDashboardByUid(options.dashboardUid) : createDashboard();

  dto.dashboard.panels = [panel, ...(dto.dashboard.panels ?? [])];

  setDashboardToFetchFromLocalStorage(dto);
}

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

function getPanelType(queries: DataQuery[], queryResponse: ExplorePanelData) {
  for (const { refId } of queries.filter(isVisible)) {
    // traceview is not supported in dashboards, skipping it for now.
    const hasQueryRefId = hasRefId(refId);
    if (queryResponse.graphFrames.some(hasQueryRefId)) {
      return 'timeseries';
    }
    if (queryResponse.logsFrames.some(hasQueryRefId)) {
      return 'logs';
    }
    if (queryResponse.nodeGraphFrames.some(hasQueryRefId)) {
      return 'nodeGraph';
    }
  }

  // falling back to table
  return 'table';
}
