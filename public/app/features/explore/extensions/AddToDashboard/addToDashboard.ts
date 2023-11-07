import { DataFrame, ExplorePanelsState } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { DataTransformerConfig } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  getNewDashboardModelData,
  setDashboardToFetchFromLocalStorage,
} from 'app/features/dashboard/state/initDashboard';
import { DashboardDTO, ExplorePanelData } from 'app/types';

export enum AddToDashboardError {
  FETCH_DASHBOARD = 'fetch-dashboard',
  SET_DASHBOARD_LS = 'set-dashboard-ls-error',
}

interface AddPanelToDashboardOptions {
  queries: DataQuery[];
  queryResponse: ExplorePanelData;
  datasource?: DataSourceRef;
  dashboardUid?: string;
  panelState?: ExplorePanelsState;
}

function createDashboard(): DashboardDTO {
  const dto = getNewDashboardModelData();

  // getNewDashboardModelData adds by default the "add-panel" panel. We don't want that.
  dto.dashboard.panels = [];

  return dto;
}

function getLogsTableTransformations(panelType: string, options: AddPanelToDashboardOptions): DataTransformerConfig[] {
  let transformations: DataTransformerConfig[] = [];
  if (panelType === 'table' && options.panelState?.logs?.columns) {
    // If we have a labels column, we need to extract the fields from it
    if (options.panelState.logs?.labelName) {
      transformations.push({
        id: 'extractFields',
        options: {
          source: options.panelState.logs.labelName,
        },
      });
    }

    // If we have columns defined, set them to show in the table via the organize/includeByName transformation
    transformations.push({
      id: 'organize',
      options: {
        includeByName: Object.values(options.panelState.logs.columns).reduce(
          (a: Record<string, boolean>, v) => ({
            ...a,
            [v]: true,
          }),
          {}
        ),
      },
    });
  }
  return transformations;
}

function getExploreToPanelTransformations(panelType: string, options: AddPanelToDashboardOptions) {
  let transformations: DataTransformerConfig[] = [];
  transformations.push(...getLogsTableTransformations(panelType, options));

  return transformations;
}

export async function setDashboardInLocalStorage(options: AddPanelToDashboardOptions) {
  const panelType = getPanelType(options.queries, options.queryResponse, options?.panelState);
  let transformations = getExploreToPanelTransformations(panelType, options);

  const panel = {
    targets: options.queries,
    type: panelType,
    title: 'New Panel',
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    datasource: options.datasource,
    transformations: transformations,
  };

  let dto: DashboardDTO;

  if (options.dashboardUid) {
    try {
      dto = await backendSrv.getDashboardByUid(options.dashboardUid);
    } catch (e) {
      throw AddToDashboardError.FETCH_DASHBOARD;
    }
  } else {
    dto = createDashboard();
  }

  dto.dashboard.panels = [panel, ...(dto.dashboard.panels ?? [])];

  try {
    setDashboardToFetchFromLocalStorage(dto);
  } catch {
    throw AddToDashboardError.SET_DASHBOARD_LS;
  }
}

const isVisible = (query: DataQuery) => !query.hide;
const hasRefId = (refId: DataFrame['refId']) => (frame: DataFrame) => frame.refId === refId;

function getPanelType(queries: DataQuery[], queryResponse: ExplorePanelData, panelState?: ExplorePanelsState) {
  for (const { refId } of queries.filter(isVisible)) {
    const hasQueryRefId = hasRefId(refId);
    if (queryResponse.flameGraphFrames.some(hasQueryRefId)) {
      return 'flamegraph';
    }
    if (queryResponse.graphFrames.some(hasQueryRefId)) {
      return 'timeseries';
    }
    if (queryResponse.logsFrames.some(hasQueryRefId)) {
      if (panelState?.logs?.visualisationType) {
        return panelState.logs.visualisationType;
      }
      return 'logs';
    }
    if (queryResponse.nodeGraphFrames.some(hasQueryRefId)) {
      return 'nodeGraph';
    }
    if (queryResponse.traceFrames.some(hasQueryRefId)) {
      return 'traces';
    }
    if (queryResponse.customFrames.some(hasQueryRefId)) {
      // we will always have a custom frame and meta, it should never default to 'table' (but all paths must return a string)
      return queryResponse.customFrames.find(hasQueryRefId)?.meta?.preferredVisualisationPluginId ?? 'table';
    }
  }

  // falling back to table
  return 'table';
}
