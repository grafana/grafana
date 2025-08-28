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
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { ConditionalRenderingGroup } from '../../conditional-rendering/ConditionalRenderingGroup';
import { conditionalRenderingSerializerRegistry } from '../../conditional-rendering/serializers';
import { CustomTimeRangeCompare } from '../../scene/CustomTimeRangeCompare';
import { DashboardDatasourceBehaviour } from '../../scene/DashboardDatasourceBehaviour';
import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../../scene/PanelMenuBehavior';
import { PanelNotices } from '../../scene/PanelNotices';
import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
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
    $behaviors: [],
    extendPanelContext: setDashboardPanelContext,
    // _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel), //FIXME: Angular Migration
    headerActions: config.featureToggles.timeComparison
      ? [new CustomTimeRangeCompare({ key: 'time-compare', compareWith: undefined, compareOptions: [] })]
      : undefined,
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
    seriesLimit: config.panelSeriesLimit,
    $behaviors: [
      new LibraryPanelBehavior({
        uid: panel.spec.libraryPanel.uid,
        name: panel.spec.libraryPanel.name,
      }),
    ],
    extendPanelContext: setDashboardPanelContext,
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
  const targets = panel.data?.spec.queries ?? [];
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

function getPanelDataSource(panel: PanelKind): DataSourceRef | undefined {
  if (!panel.spec.data?.spec.queries?.length) {
    return undefined;
  }

  let datasource: DataSourceRef | undefined = undefined;
  let isMixedDatasource = false;

  panel.spec.data.spec.queries.forEach((query) => {
    if (!datasource) {
      if (!query.spec.query.datasource?.name) {
        datasource = getRuntimePanelDataSource(query.spec.query);
      } else {
        datasource = {
          uid: query.spec.query.datasource?.name,
          type: query.spec.query.group,
        };
      }
    } else if (datasource.uid !== query.spec.query.datasource?.name || datasource.type !== query.spec.query.group) {
      isMixedDatasource = true;
    }
  });

  return isMixedDatasource ? { type: 'mixed', uid: MIXED_DATASOURCE_NAME } : datasource;
}

export function getRuntimeVariableDataSource(variable: QueryVariableKind): DataSourceRef | undefined {
  const ds: DataSourceRef = {
    uid: variable.spec.query.datasource?.name,
    type: variable.spec.query.group,
  };
  return getDataSourceForQuery(ds, variable.spec.query.group);
}

export function getRuntimePanelDataSource(query: DataQueryKind): DataSourceRef {
  const ds: DataSourceRef = {
    uid: query.datasource?.name,
    type: query.group,
  };
  return getDataSourceForQuery(ds, query.group);
}

/**
 * @param querySpecDS - The datasource specified in the query
 * @param queryKind - The kind of query being performed
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
  return {
    refId: query.spec.refId,
    datasource: getRuntimePanelDataSource(query.spec.query),
    hide: query.spec.hidden,
    ...query.spec.query.spec,
  };
}

export function getLayout(sceneState: DashboardLayoutManager): DashboardV2Spec['layout'] {
  return sceneState.serialize();
}

export function getConditionalRendering(
  item: TabsLayoutTabKind | RowsLayoutRowKind | AutoGridLayoutItemKind
): ConditionalRendering {
  if (!item.spec.conditionalRendering) {
    return ConditionalRendering.createEmpty();
  }

  const rootGroup = conditionalRenderingSerializerRegistry
    .get(item.spec.conditionalRendering.kind)
    .deserialize(item.spec.conditionalRendering);

  if (rootGroup && !(rootGroup instanceof ConditionalRenderingGroup)) {
    throw new Error(`Conditional rendering must always start with a root group`);
  }

  return new ConditionalRendering({ rootGroup: rootGroup });
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
