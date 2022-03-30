import { DataFrame, DataQuery } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  getNewDashboardModelData,
  setDashboardToFetchFromLocalStorage,
} from 'app/features/dashboard/state/initDashboard';
import { DashboardDTO, ExploreItemState, ExplorePanelData } from 'app/types';

export enum SaveTarget {
  NewDashboard,
  ExistingDashboard,
}

export interface AddPanelToDashboardOptions {
  exploreItem: ExploreItemState;
  targetMode: SaveTarget;
  openInNewTab?: boolean;
  dashboardUid?: string;
}

export function addPanelToDashboard(options: AddPanelToDashboardOptions) {
  const queries = options.exploreItem?.queries || [];
  const datasource = options.exploreItem?.datasourceInstance;
  const panelType = getPanelTypeFor(queries, options.exploreItem?.queryResponse);
  const panel = {
    targets: queries,
    type: panelType,
    title: 'New Panel',
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    datasource,
  };

  if (options.targetMode === SaveTarget.NewDashboard) {
    addToNewDashboard(panel, options.openInNewTab);
  } else {
    addToExisting(panel, options.dashboardUid!, options.openInNewTab);
  }
}

function addToNewDashboard(panel: any, openInNewTab?: boolean) {
  const dto = getNewDashboardModelData();
  dto.dashboard.panels = [panel];
  openDashboard('dashboard/new', dto, openInNewTab);
}

async function addToExisting(panel: any, uid: string, openInNewTab?: boolean) {
  const dto = await backendSrv.getDashboardByUid(uid);
  dto.dashboard.panels = [panel, ...(dto.dashboard.panels ?? [])];
  openDashboard(`d/${uid}`, dto, openInNewTab);
}

function openDashboard(url: string, dto: DashboardDTO, openInNewTab?: boolean) {
  setDashboardToFetchFromLocalStorage(dto);

  if (!openInNewTab) {
    locationService.push('dashboard/new');
  } else {
    window.open(config.appUrl + url, '_blank');
  }
}

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

export function getPanelTypeFor(queries: DataQuery[], queryResponse?: ExplorePanelData) {
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
