import { FeatureLike } from 'ol/Feature';
import OpenLayersMap from 'ol/Map';
import BaseLayer from 'ol/layer/Base';
import LayerGroup from 'ol/layer/Group';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { Subject } from 'rxjs';

import { getFrameMatchers, MapLayerHandler, MapLayerOptions, PanelData, textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';

import { GeomapPanel } from '../GeomapPanel';
import { MARKERS_LAYER_ID } from '../layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { MapLayerState } from '../types';

import { getNextLayerName } from './utils';

const layerStateMap = new WeakMap<BaseLayer, MapLayerState>();

export const applyLayerFilter = (
  handler: MapLayerHandler<unknown>,
  options: MapLayerOptions<unknown>,
  panelDataProps: PanelData
): void => {
  if (handler.update) {
    let panelData = panelDataProps;
    if (options.filterData) {
      const matcherFunc = getFrameMatchers(options.filterData);
      panelData = {
        ...panelData,
        series: panelData.series.filter(matcherFunc),
      };
    }
    handler.update(panelData);
  }
};

export async function updateLayer(panel: GeomapPanel, uid: string, newOptions: MapLayerOptions): Promise<boolean> {
  if (!panel.map) {
    return false;
  }
  const current = panel.byName.get(uid);
  if (!current) {
    return false;
  }

  let layerIndex = -1;
  const group = panel.map?.getLayers()!;
  for (let i = 0; i < group?.getLength(); i++) {
    if (group.item(i) === current.layer) {
      layerIndex = i;
      break;
    }
  }

  // Special handling for rename
  if (newOptions.name !== uid) {
    if (!newOptions.name) {
      newOptions.name = uid;
    } else if (panel.byName.has(newOptions.name)) {
      return false;
    }
    panel.byName.delete(uid);

    uid = newOptions.name;
    panel.byName.set(uid, current);
  }

  // Type changed -- requires full re-initalization
  if (current.options.type !== newOptions.type) {
    // full init
  } else {
    // just update options
  }

  const layers = panel.layers.slice(0);
  try {
    const info = await initLayer(panel, panel.map, newOptions, current.isBasemap);
    layers[layerIndex]?.handler.dispose?.();
    layers[layerIndex] = info;
    group.setAt(layerIndex, info.layer);

    // initialize with new data
    applyLayerFilter(info.handler, newOptions, panel.props.data);
  } catch (err) {
    console.warn('ERROR', err);
    return false;
  }

  // Just to trigger a state update
  panel.setState({ legends: [] });

  panel.layers = layers;
  panel.doOptionsUpdate(layerIndex);
  return true;
}

export async function initLayer(
  panel: GeomapPanel,
  map: OpenLayersMap,
  options: MapLayerOptions,
  isBasemap?: boolean
): Promise<MapLayerState> {
  if (isBasemap && (!options?.type || config.geomapDisableCustomBaseLayer)) {
    options = DEFAULT_BASEMAP_CONFIG;
  }

  // Use default makers layer
  if (!options?.type) {
    options = {
      type: MARKERS_LAYER_ID,
      name: getNextLayerName(panel),
      config: {},
    };
  }

  const item = geomapLayerRegistry.getIfExists(options.type);
  if (!item) {
    return Promise.reject('unknown layer: ' + options.type);
  }

  if (options.config?.attribution) {
    options.config.attribution = textUtil.sanitizeTextPanelContent(options.config.attribution);
  }

  const handler = await item.create(map, options, panel.props.eventBus, config.theme2);
  const layer = handler.init();
  if (options.opacity != null) {
    layer.setOpacity(options.opacity);
  }

  if (!options.name) {
    options.name = getNextLayerName(panel);
  }

  const UID = options.name;
  const state: MapLayerState<unknown> = {
    // UID, // unique name when added to the map (it may change and will need special handling)
    isBasemap,
    options,
    layer,
    handler,
    mouseEvents: new Subject<FeatureLike | undefined>(),

    getName: () => UID,

    // Used by the editors
    onChange: (cfg: MapLayerOptions) => {
      updateLayer(panel, UID, cfg);
    },
  };

  panel.byName.set(UID, state);
  layerStateMap.set(state.layer, state);

  // Pass state into WebGLPointsLayers contained in a LayerGroup
  if (layer instanceof LayerGroup) {
    layer
      .getLayers()
      .getArray()
      .forEach((layer: BaseLayer) => {
        if (layer instanceof WebGLPointsLayer) {
          layerStateMap.set(layer, state);
        }
      });
  }

  applyLayerFilter(handler, options, panel.props.data);

  return state;
}

export const getMapLayerState = (l: BaseLayer | undefined): MapLayerState | undefined => {
  return l ? layerStateMap.get(l) : undefined;
};
