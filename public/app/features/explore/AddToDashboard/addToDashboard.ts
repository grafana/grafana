import { DataFrame, DataQuery } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  getNewDashboardModelData,
  setDashboardToFetchFromLocalStorage,
} from 'app/features/dashboard/state/initDashboard';
import { ExploreItemState, ExplorePanelData } from 'app/types';

interface AddPanelToDashboardOptions {
  exploreItem: ExploreItemState;
  dashboardUid?: string;
}

function createDashboard() {
  const dto = getNewDashboardModelData();

  // getNewDashboardModelData adds by default the "add-panel" panel. We don't want that.
  dto.dashboard.panels = [];

  return dto;
}

export async function addPanelToDashboard(options: AddPanelToDashboardOptions) {
  const queries = options.exploreItem?.queries || [];
  const datasource = options.exploreItem?.datasourceInstance;
  const panelType = getPanelType(queries, options.exploreItem?.queryResponse);
  const panel = {
    targets: queries,
    type: panelType,
    title: 'New Panel',
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    datasource,
  };

  const dto = options.dashboardUid ? await backendSrv.getDashboardByUid(options.dashboardUid) : createDashboard();

  dto.dashboard.panels = [panel, ...(dto.dashboard.panels ?? [])];

  setDashboardToFetchFromLocalStorage(dto);
}

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

export function getPanelType(queries: DataQuery[], queryResponse?: ExplorePanelData) {
  if (!queryResponse) {
    // return table if no response
    return 'table';
  }

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
