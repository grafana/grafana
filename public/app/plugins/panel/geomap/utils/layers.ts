import { Map as OpenLayersMap } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Subject } from 'rxjs';

import { getFrameMatchers, MapLayerHandler, MapLayerOptions, PanelData } from '@grafana/data/src';
import { config } from '@grafana/runtime/src';

import { GeomapPanel } from '../GeomapPanel';
import { MARKERS_LAYER_ID } from '../layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { MapLayerState } from '../types';

import { getNextLayerName } from './utils';

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
    console.warn('ERROR', err); // eslint-disable-line no-console
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

  const handler = await item.create(map, options, panel.props.eventBus, config.theme2);
  const layer = handler.init(); // eslint-disable-line
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
  // eslint-disable-next-line
  (state.layer as any).__state = state;

  applyLayerFilter(handler, options, panel.props.data);

  return state;
}

export const getMapLayerState = (l: any) => {
  return l?.__state as MapLayerState;
};
