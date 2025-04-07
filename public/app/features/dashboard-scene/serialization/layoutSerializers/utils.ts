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
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { ConditionalRenderingGroup } from '../../conditional-rendering/ConditionalRenderingGroup';
import { conditionalRenderingSerializerRegistry } from '../../conditional-rendering/serializers';
import { DashboardDatasourceBehaviour } from '../../scene/DashboardDatasourceBehaviour';
import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../../scene/PanelMenuBehavior';
import { PanelNotices } from '../../scene/PanelNotices';
import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { AutoGridItem } from '../../scene/layout-responsive-grid/ResponsiveGridItem';
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
    pluginId: panel.spec.vizConfig.kind,
    options: panel.spec.vizConfig.spec.options,
    fieldConfig: transformMappingsToV1(panel.spec.vizConfig.spec.fieldConfig),
    pluginVersion: panel.spec.vizConfig.spec.pluginVersion,
    displayMode: panel.spec.transparent ? 'transparent' : 'default',
    hoverHeader: !panel.spec.title && !timeOverrideShown,
    hoverHeaderOffset: 0,
    $data: createPanelDataProvider(panel),
    titleItems,
    $behaviors: [],
    extendPanelContext: setDashboardPanelContext,
    // _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel), //FIXME: Angular Migration
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
      if (!query.spec.datasource?.uid) {
        const defaultDatasource = config.bootData.settings.defaultDatasource;
        const dsList = config.bootData.settings.datasources;
        // this is look up by type
        const bestGuess = Object.values(dsList).find((ds) => ds.meta.id === query.spec.query.kind);
        datasource = bestGuess ? { uid: bestGuess.uid, type: bestGuess.meta.id } : dsList[defaultDatasource];
      } else {
        datasource = query.spec.datasource;
      }
    } else if (datasource.uid !== query.spec.datasource?.uid || datasource.type !== query.spec.datasource?.type) {
      isMixedDatasource = true;
    }
  });

  return isMixedDatasource ? { type: 'mixed', uid: MIXED_DATASOURCE_NAME } : datasource;
}

export function getRuntimeVariableDataSource(variable: QueryVariableKind): DataSourceRef | undefined {
  let datasource: DataSourceRef | undefined = undefined;

  if (!datasource) {
    if (!variable.spec.datasource?.uid) {
      const defaultDatasource = config.bootData.settings.defaultDatasource;
      const dsList = config.bootData.settings.datasources;
      // this is look up by type
      const bestGuess = Object.values(dsList).find((ds) => ds.meta.id === variable.spec.query.kind);
      datasource = bestGuess ? { uid: bestGuess.uid, type: bestGuess.meta.id } : dsList[defaultDatasource];
    } else {
      datasource = variable.spec.datasource;
    }
  }
  return datasource;
}

function panelQueryKindToSceneQuery(query: PanelQueryKind): SceneDataQuery {
  return {
    refId: query.spec.refId,
    datasource: query.spec.datasource,
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
