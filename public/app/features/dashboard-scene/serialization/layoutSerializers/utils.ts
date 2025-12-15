import { config } from '@grafana/runtime';
import {
  SceneDataProvider,
  SceneDataQuery,
  SceneDataTransformer,
  SceneObject,
  SceneQueryRunner,
  VizPanel,
  VizPanelMenu,
  VizPanelState,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema/dist/esm/index.gen';
import {
  Spec as DashboardV2Spec,
  AutoGridLayoutItemKind,
  RowsLayoutRowKind,
  LibraryPanelKind,
  PanelKind,
  PanelQueryKind,
  QueryVariableKind,
  TabsLayoutTabKind,
  DataQueryKind,
  defaultPanelQueryKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { DashboardDatasourceBehaviour } from '../../scene/DashboardDatasourceBehaviour';
import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../../scene/PanelMenuBehavior';
import { PanelNotices } from '../../scene/PanelNotices';
import { VizPanelHeaderActions } from '../../scene/VizPanelHeaderActions';
import { VizPanelSubHeader } from '../../scene/VizPanelSubHeader';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { setDashboardPanelContext } from '../../scene/setDashboardPanelContext';
import { DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';
import { getVizPanelKeyForPanelId } from '../../utils/utils';
import { createElements, vizPanelToSchemaV2 } from '../transformSceneToSaveModelSchemaV2';
import { transformMappingsToV1 } from '../transformToV1TypesUtils';
import { transformDataTopic } from '../transformToV2TypesUtils';

export function buildVizPanel(panel: PanelKind, id?: number): VizPanel {
  const titleItems: SceneObject[] = [];

  titleItems.push(
    new VizPanelLinks({
      rawLinks: panel.spec.links,
      menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
    })
  );

  titleItems.push(new PanelNotices());

  const queryOptions = panel.spec.data.spec.queryOptions;
  const timeOverrideShown = (queryOptions.timeFrom || queryOptions.timeShift) && !queryOptions.hideTimeOverride;

  const vizPanelState: VizPanelState = {
    key: getVizPanelKeyForPanelId(id ?? panel.spec.id),
    title: panel.spec.title?.substring(0, 5000),
    description: panel.spec.description,
    pluginId: panel.spec.vizConfig.group,
    options: panel.spec.vizConfig.spec.options,
    fieldConfig: transformMappingsToV1(panel.spec.vizConfig.spec.fieldConfig),
    pluginVersion: panel.spec.vizConfig.version,
    displayMode: panel.spec.transparent ? 'transparent' : 'default',
    hoverHeader: !panel.spec.title && !timeOverrideShown,
    hoverHeaderOffset: 0,
    seriesLimit: config.panelSeriesLimit,
    $data: createPanelDataProvider(panel),
    titleItems,
    headerActions: new VizPanelHeaderActions({
      hideGroupByAction: !config.featureToggles.panelGroupBy,
    }),
    subHeader: new VizPanelSubHeader({
      hideNonApplicableDrilldowns: !config.featureToggles.perPanelNonApplicableDrilldowns,
    }),
    $behaviors: [],
    extendPanelContext: setDashboardPanelContext,
  };

  if (!config.publicDashboardAccessToken) {
    vizPanelState.menu = new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    });
  }

  if (queryOptions.timeFrom || queryOptions.timeShift) {
    vizPanelState.$timeRange = new PanelTimeRange({
      timeFrom: queryOptions.timeFrom,
      timeShift: queryOptions.timeShift,
      hideTimeOverride: queryOptions.hideTimeOverride,
    });
  }

  return new VizPanel(vizPanelState);
}

export function buildLibraryPanel(panel: LibraryPanelKind, id?: number): VizPanel {
  const titleItems: SceneObject[] = [];

  titleItems.push(
    new VizPanelLinks({
      rawLinks: [],
      menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
    })
  );

  titleItems.push(new PanelNotices());

  const vizPanelState: VizPanelState = {
    key: getVizPanelKeyForPanelId(id ?? panel.spec.id),
    titleItems,
    subHeader: new VizPanelSubHeader({
      hideNonApplicableDrilldowns: !config.featureToggles.perPanelNonApplicableDrilldowns,
    }),
    seriesLimit: config.panelSeriesLimit,
    $behaviors: [
      new LibraryPanelBehavior({
        uid: panel.spec.libraryPanel.uid,
        name: panel.spec.libraryPanel.name,
      }),
    ],
    extendPanelContext: setDashboardPanelContext,
    headerActions: new VizPanelHeaderActions({
      hideGroupByAction: !config.featureToggles.panelGroupBy,
    }),
    pluginId: LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID,
    title: panel.spec.title,
    options: {},
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
  };

  if (!config.publicDashboardAccessToken) {
    vizPanelState.menu = new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    });
  }

  return new VizPanel(vizPanelState);
}

export function createPanelDataProvider(panelKind: PanelKind): SceneDataProvider | undefined {
  const panel = panelKind.spec;

  const targets =
    // Default to an array with an empty data query with a `refId` already assigned
    Array.isArray(panel.data?.spec.queries) && panel.data?.spec.queries.length > 0
      ? panel.data?.spec.queries
      : [defaultPanelQueryKind()];
  // Skip setting query runner for panels without queries
  if (!targets?.length) {
    return undefined;
  }

  // Skip setting query runner for panel plugins with skipDataQuery
  if (config.panels[panel.vizConfig.kind]?.skipDataQuery) {
    return undefined;
  }

  let dataProvider: SceneDataProvider | undefined = undefined;
  const datasource = getPanelDataSource(panelKind);

  dataProvider = new SceneQueryRunner({
    datasource,
    queries: targets.map(panelQueryKindToSceneQuery),
    maxDataPoints: panel.data.spec.queryOptions.maxDataPoints ?? undefined,
    maxDataPointsFromWidth: true,
    cacheTimeout: panel.data.spec.queryOptions.cacheTimeout,
    queryCachingTTL: panel.data.spec.queryOptions.queryCachingTTL,
    minInterval: panel.data.spec.queryOptions.interval ?? undefined,
    dataLayerFilter: {
      panelId: panel.id,
    },
    $behaviors: [new DashboardDatasourceBehaviour({})],
  });

  // Wrap inner data provider in a data transformer
  return new SceneDataTransformer({
    $data: dataProvider,
    transformations: panel.data.spec.transformations.map((t) => {
      return {
        ...t.spec,
        topic: transformDataTopic(t.spec.topic),
      };
    }),
  });
}

/**
 * Get panel-level datasource for a v2beta1 panel.
 *
 * In v2beta1 schema, there's NO panel-level datasource concept - each query has its own.
 * However, we still need to set panel-level datasource to "mixed" when queries use
 * different datasources, so the Scene can properly handle mixed datasource mode.
 *
 * This function returns:
 * - Mixed datasource if queries use different datasources
 * - undefined otherwise (each query has its own datasource)
 *
 * This ensures v2→Scene→v1 conversion produces the same output as the Go backend,
 * which does NOT add panel-level datasource for non-mixed panels.
 */
function getPanelDataSource(panel: PanelKind): DataSourceRef | undefined {
  if (!panel.spec.data?.spec.queries?.length) {
    return undefined;
  }

  let firstDatasource: DataSourceRef | undefined = undefined;
  let isMixedDatasource = false;

  panel.spec.data.spec.queries.forEach((query) => {
    const queryDs = query.spec.query.datasource?.name
      ? { uid: query.spec.query.datasource.name, type: query.spec.query.group }
      : getRuntimePanelDataSource(query.spec.query);

    if (!firstDatasource) {
      firstDatasource = queryDs;
    } else if (firstDatasource.uid !== queryDs?.uid || firstDatasource.type !== queryDs?.type) {
      isMixedDatasource = true;
    }
  });

  // Only return mixed datasource - for non-mixed panels, each query already has its own datasource
  // This matches the Go backend behavior which doesn't add panel.datasource for non-mixed panels
  return isMixedDatasource ? { type: 'mixed', uid: MIXED_DATASOURCE_NAME } : undefined;
}

/**
 * Get runtime datasource for a query variable.
 * For V2→V1 conversion consistency:
 * - If V2 has explicit UID (datasource.name): return {uid, type}
 * - If V2 has only type (group): return {type} only (no UID resolution)
 * - If V2 has neither: return undefined
 * @param variable - The query variable
 */
export function getRuntimeVariableDataSource(variable: QueryVariableKind): DataSourceRef | undefined {
  const explicitUid = variable.spec.query.datasource?.name;
  const queryType = variable.spec.query.group;

  // If explicit UID provided, resolve fully
  if (explicitUid) {
    return getDataSourceForQuery({ uid: explicitUid, type: queryType }, queryType);
  }

  // If only type provided (no explicit UID), return type-only to match backend V2→V1 conversion
  if (queryType) {
    return { type: queryType };
  }

  // Neither UID nor type - no datasource
  return undefined;
}

/**
 * Get runtime datasource for a panel query or annotation.
 * For V2→V1 conversion consistency:
 * - If V2 has explicit UID (datasource.name): return {uid, type}
 * - If V2 has only type (group): return {type} only (no UID resolution)
 * - If V2 has neither: return undefined (caller should handle default)
 * @param query - The data query
 */
export function getRuntimePanelDataSource(query: DataQueryKind): DataSourceRef | undefined {
  const explicitUid = query.datasource?.name;
  const queryType = query.group;

  // If explicit UID provided, resolve fully
  if (explicitUid) {
    return getDataSourceForQuery({ uid: explicitUid, type: queryType }, queryType);
  }

  // If only type provided (no explicit UID), return type-only to match backend V2→V1 conversion
  if (queryType) {
    return { type: queryType };
  }

  // Neither UID nor type - no datasource
  return undefined;
}

/**
 * Resolves a datasource reference for a query.
 * @param querySpecDS - The datasource specified in the query
 * @param queryKind - The kind of query being performed (datasource type)
 * @returns The resolved DataSourceRef
 */
export function getDataSourceForQuery(querySpecDS: DataSourceRef | undefined | null, queryKind: string): DataSourceRef {
  // If datasource is specified and has a uid, use it
  if (querySpecDS?.uid) {
    return querySpecDS;
  }

  // Otherwise try to infer datasource based on query kind (kind = ds type)
  const defaultDatasource = config.defaultDatasource;
  const dsList = config.datasources;

  // First check if the default datasource matches the query type
  if (dsList && dsList[defaultDatasource] && dsList[defaultDatasource].meta.id === queryKind) {
    // In the datasource list from bootData "id" is the type and the uid could be uid or the name
    // in cases like grafana, dashboard or mixed datasource
    return {
      uid: dsList[defaultDatasource].uid || dsList[defaultDatasource].name,
      type: dsList[defaultDatasource].meta.id,
    };
  }

  // Look up by query type/kind from all available datasources
  const bestGuess = dsList && Object.values(dsList).find((ds) => ds.meta.id === queryKind);

  if (bestGuess) {
    return { uid: bestGuess.uid, type: bestGuess.meta.id };
  } else if (dsList && dsList[defaultDatasource]) {
    // Fallback to default datasource even if type doesn't match
    // In the datasource list from bootData "id" is the type and the uid could be uid or the name
    // in cases like grafana, dashboard or mixed datasource

    console.warn(
      `Could not find datasource for query kind ${queryKind}, defaulting to ${dsList[defaultDatasource].meta.id}`
    );
    return {
      uid: dsList[defaultDatasource].uid || dsList[defaultDatasource].name,
      type: dsList[defaultDatasource].meta.id,
    };
  }

  if (dsList && !dsList[defaultDatasource]) {
    throw new Error(`Default datasource ${defaultDatasource} not found in datasource list`);
  }

  // In the datasource list from bootData "id" is the type and the uid could be uid or the name
  // in cases like grafana, dashboard or mixed datasource
  return {
    uid: dsList[defaultDatasource].uid || dsList[defaultDatasource].name,
    type: dsList[defaultDatasource].meta.id,
  };
}

function panelQueryKindToSceneQuery(query: PanelQueryKind): SceneDataQuery {
  // Add datasource to match Go backend V2→V1 conversion:
  // - If explicit UID (datasource.name) exists → add { uid, type }
  // - If only type (group) exists → add { type } only
  // - If neither → no datasource
  const datasource = getRuntimePanelDataSource(query.spec.query);

  return {
    refId: query.spec.refId,
    hide: query.spec.hidden,
    ...(datasource ? { datasource } : {}),
    ...query.spec.query.spec,
  };
}

export function getLayout(sceneState: DashboardLayoutManager): DashboardV2Spec['layout'] {
  return sceneState.serialize();
}

export function getConditionalRendering(
  item: TabsLayoutTabKind | RowsLayoutRowKind | AutoGridLayoutItemKind
): ConditionalRenderingGroup {
  if (!item.spec.conditionalRendering) {
    return ConditionalRenderingGroup.createEmpty();
  }

  return ConditionalRenderingGroup.deserialize(item.spec.conditionalRendering);
}

export function getElements(layout: DashboardLayoutManager, scene: DashboardScene): DashboardV2Spec['elements'] {
  const panels = layout.getVizPanels();
  const dsReferencesMapping = scene.serializer.getDSReferencesMapping();
  const panelsArray = panels.map((vizPanel) => {
    return vizPanelToSchemaV2(vizPanel, dsReferencesMapping);
  });
  return createElements(panelsArray, scene);
}

export function getElement(
  gridItem: AutoGridItem | DashboardGridItem,
  scene: DashboardScene
): DashboardV2Spec['elements'] {
  return createElements([vizPanelToSchemaV2(gridItem.state.body, scene.serializer.getDSReferencesMapping())], scene);
}
