import { DataFrame, ExplorePanelsState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery, DataSourceRef, Panel } from '@grafana/schema';
import { DataTransformerConfig } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import { ExplorePanelData } from 'app/types/explore';

interface ExploreToDashboardPanelOptions {
  queries: DataQuery[];
  queryResponse: ExplorePanelData;
  datasource?: DataSourceRef;
  dashboardUid?: string;
  panelState?: ExplorePanelsState;
}

/**
 * Returns transformations for the logs table visualisation in explore.
 * If the logs table supports a labels column, we need to extract the fields.
 * Then we can set the columns to show in the table via the organize/includeByName transformation
 * @param panelType
 * @param options
 */
function getLogsTableTransformations(
  panelType: string,
  options: ExploreToDashboardPanelOptions
): DataTransformerConfig[] {
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

export function buildDashboardPanelFromExploreState(options: ExploreToDashboardPanelOptions): Panel {
  const panelType = getPanelType(options.queries, options.queryResponse, options?.panelState);

  return {
    //@ts-ignore
    targets: options.queries,
    type: panelType,
    title: t('explore.build-dashboard-panel-from-explore-state.title.new-panel', 'New Panel'),
    gridPos: { x: 0, y: 0, w: 12, h: 8 },
    datasource: options.datasource,
    transformations: getLogsTableTransformations(panelType, options),
  };
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
