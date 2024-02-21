import { DataFrame, ExplorePanelsState } from '@grafana/data';
import { Dashboard, DataQuery, DataSourceRef } from '@grafana/schema';
import { DataTransformerConfig } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import { setDashboardToFetchFromLocalStorage } from 'app/features/dashboard/state/initDashboard';
import { buildNewDashboardSaveModel } from 'app/features/dashboard-scene/serialization/buildNewDashboardSaveModel';
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
  time: Dashboard['time'];
}

/**
 * Returns transformations for the logs table visualisation in explore.
 * If the logs table supports a labels column, we need to extract the fields.
 * Then we can set the columns to show in the table via the organize/includeByName transformation
 * @param panelType
 * @param options
 */
function getLogsTableTransformations(panelType: string, options: AddPanelToDashboardOptions): DataTransformerConfig[] {
  let transformations: DataTransformerConfig[] = [];
  if (panelType === 'table' && options.panelState?.logs?.columns) {
    // If we have a labels column, we need to extract the fields from it
    if (options.panelState.logs?.labelFieldName) {
      transformations.push({
        id: 'extractFields',
        options: {
          source: options.panelState.logs.labelFieldName,
        },
      });
    }

    // Show the columns that the user selected in explore
    transformations.push({
      id: 'organize',
      options: {
        indexByName: Object.values(options.panelState.logs.columns).reduce(
          (acc: Record<string, number>, value: string, idx) => ({
            ...acc,
            [value]: idx,
          }),
          {}
        ),
        includeByName: Object.values(options.panelState.logs.columns).reduce(
          (acc: Record<string, boolean>, value: string) => ({
            ...acc,
            [value]: true,
          }),
          {}
        ),
      },
    });
  }
  return transformations;
}

export async function setDashboardInLocalStorage(options: AddPanelToDashboardOptions) {
  const panelType = getPanelType(options.queries, options.queryResponse, options?.panelState);

  const panel = {
    targets: options.queries,
    type: panelType,
    title: 'New Panel',
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    datasource: options.datasource,
    transformations: getLogsTableTransformations(panelType, options),
  };

  let dto: DashboardDTO;

  if (options.dashboardUid) {
    try {
      dto = await backendSrv.getDashboardByUid(options.dashboardUid);
    } catch (e) {
      throw AddToDashboardError.FETCH_DASHBOARD;
    }
  } else {
    dto = buildNewDashboardSaveModel();
  }

  dto.dashboard.panels = [panel, ...(dto.dashboard.panels ?? [])];

  dto.dashboard.time = options.time;

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
