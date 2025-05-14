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
import { DashboardV2Spec, PanelKind, PanelQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardDatasourceBehaviour } from '../../scene/DashboardDatasourceBehaviour';
import { VizPanelLinks, VizPanelLinksMenu } from '../../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../../scene/PanelMenuBehavior';
import { PanelNotices } from '../../scene/PanelNotices';
import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { AngularDeprecation } from '../../scene/angular/AngularDeprecation';
import { setDashboardPanelContext } from '../../scene/setDashboardPanelContext';
import { DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';
import { getVizPanelKeyForPanelId } from '../../utils/utils';
import { transformMappingsToV1 } from '../transformToV1TypesUtils';

import { layoutSerializerRegistry } from './layoutSerializerRegistry';

export function buildVizPanel(panel: PanelKind): VizPanel {
  const titleItems: SceneObject[] = [];

  if (config.featureToggles.angularDeprecationUI) {
    titleItems.push(new AngularDeprecation());
  }

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
    key: getVizPanelKeyForPanelId(panel.spec.id),
    title: panel.spec.title,
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
    transformations: panel.data.spec.transformations.map((transformation) => transformation.spec),
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
      datasource = query.spec.datasource;
    } else if (datasource.uid !== query.spec.datasource?.uid || datasource.type !== query.spec.datasource?.type) {
      isMixedDatasource = true;
    }
  });

  return isMixedDatasource ? { type: 'mixed', uid: MIXED_DATASOURCE_NAME } : undefined;
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
  const registryItem = layoutSerializerRegistry.get(sceneState.descriptor.kind ?? '');
  if (!registryItem) {
    throw new Error(`Layout serializer not found for kind: ${sceneState.descriptor.kind}`);
  }
  return registryItem.serializer.serialize(sceneState);
}
