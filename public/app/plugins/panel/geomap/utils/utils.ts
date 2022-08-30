import { Map as OpenLayersMap, View, Collection } from 'ol';
import { Coordinate } from 'ol/coordinate';
import { isEmpty } from 'ol/extent';
import { defaults as interactionDefaults } from 'ol/interaction';
import BaseLayer from 'ol/layer/Base';
import { fromLonLat } from 'ol/proj';

import { getFrameMatchers, MapLayerHandler, MapLayerOptions, PanelData, SelectableValue } from '@grafana/data';
import { DataFrame, GrafanaTheme2 } from '@grafana/data/src';
import { getColorDimension, getScalarDimension, getScaledDimension, getTextDimension } from 'app/features/dimensions';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';

import { GeomapPanel } from '../GeomapPanel';
import { defaultStyleConfig, StyleConfig, StyleConfigState, StyleDimensions } from '../style/types';
import { GeomapPanelOptions, MapLayerState, MapViewConfig } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';

import { getLayersExtent } from './getLayersExtent';

export function getStyleDimension(
  frame: DataFrame | undefined,
  style: StyleConfigState,
  theme: GrafanaTheme2,
  customStyleConfig?: StyleConfig
) {
  const dims: StyleDimensions = {};
  if (customStyleConfig && Object.keys(customStyleConfig).length) {
    dims.color = getColorDimension(frame, customStyleConfig.color ?? defaultStyleConfig.color, theme);
    dims.size = getScaledDimension(frame, customStyleConfig.size ?? defaultStyleConfig.size);
    dims.rotation = getScalarDimension(frame, customStyleConfig.rotation ?? defaultStyleConfig.rotation);
    if (customStyleConfig.text && (customStyleConfig.text.field || customStyleConfig.text.fixed)) {
      dims.text = getTextDimension(frame, customStyleConfig.text!);
    }
  } else {
    if (style.fields) {
      if (style.fields.color) {
        dims.color = getColorDimension(frame, style.config.color ?? defaultStyleConfig.color, theme);
      }
      if (style.fields.size) {
        dims.size = getScaledDimension(frame, style.config.size ?? defaultStyleConfig.size);
      }
      if (style.fields.text) {
        dims.text = getTextDimension(frame, style.config.text!);
      }
      if (style.fields.rotation) {
        dims.rotation = getScalarDimension(frame, style.config.rotation ?? defaultStyleConfig.rotation);
      }
    }
  }

  return dims;
}

let publicGeoJSONFiles: Array<SelectableValue<string>> | undefined = undefined;

export function getPublicGeoJSONFiles(): Array<SelectableValue<string>> {
  if (!publicGeoJSONFiles) {
    publicGeoJSONFiles = [];
    initGeojsonFiles(); // async
  }
  return publicGeoJSONFiles;
}

// This will find all geojson files in the maps and gazetteer folders
async function initGeojsonFiles() {
  const ds = await getGrafanaDatasource();
  for (let folder of ['maps', 'gazetteer']) {
    ds.listFiles(folder).subscribe({
      next: (frame) => {
        frame.forEach((item) => {
          if (item.name.endsWith('.geojson')) {
            const value = `public/${folder}/${item.name}`;
            publicGeoJSONFiles!.push({
              value,
              label: value,
            });
          }
        });
      },
    });
  }
}

export function getNewOpenLayersMap(this: GeomapPanel, options: GeomapPanelOptions, div: HTMLDivElement) {
  return (this.map = new OpenLayersMap({
    view: initMapView(options.view, undefined),
    pixelRatio: 1, // or zoom?
    layers: [], // loaded explicitly below
    controls: [],
    target: div,
    interactions: interactionDefaults({
      mouseWheelZoom: false, // managed by initControls
    }),
  }));
}

export function updateMap(this: GeomapPanel, options: GeomapPanelOptions) {
  this.initControls(options.controls);
  this.forceUpdate(); // first render
}

export function notifyPanelEditor(this: GeomapPanel, layers: MapLayerState[]) {
  // Notify the panel editor
  if (this.panelContext.onInstanceStateChange) {
    this.panelContext.onInstanceStateChange({
      map: this.map,
      layers: layers,
      selected: layers.length - 1, // the top layer
      actions: this.actions,
    });
  }
}

export const initViewExtent = (view: View, config: MapViewConfig, layers: Collection<BaseLayer>) => {
  const v = centerPointRegistry.getIfExists(config.id);
  if (v) {
    let coord: Coordinate | undefined = undefined;
    if (v.lat == null) {
      if (v.id === MapCenterID.Coordinates) {
        coord = [config.lon ?? 0, config.lat ?? 0];
      } else if (v.id === MapCenterID.Fit) {
        const extent = getLayersExtent(layers);
        if (!isEmpty(extent)) {
          view.fit(extent, {
            padding: [30, 30, 30, 30],
            maxZoom: config.zoom ?? config.maxZoom,
          });
        }
      } else {
        // TODO: view requires special handling
      }
    } else {
      coord = [v.lon ?? 0, v.lat ?? 0];
    }
    if (coord) {
      view.setCenter(fromLonLat(coord));
    }
  }

  if (config.maxZoom) {
    view.setMaxZoom(config.maxZoom);
  }
  if (config.minZoom) {
    view.setMaxZoom(config.minZoom);
  }
  if (config.zoom && v?.id !== MapCenterID.Fit) {
    view.setZoom(config.zoom);
  }
};

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

export const initMapView = (
  config: MapViewConfig,
  sharedView: View | undefined,
  layers?: Collection<BaseLayer>
): View => {
  let view = new View({
    center: [0, 0],
    zoom: 1,
    showFullExtent: true, // allows zooming so the full range is visible
  });

  // With shared views, all panels use the same view instance
  if (config.shared) {
    if (!sharedView) {
      sharedView = view;
    } else {
      view = sharedView;
    }
  }
  if (layers) {
    initViewExtent(view, config, layers);
  }
  return view;
};

export const getNextLayerName = (geomapPanel: GeomapPanel) => {
  let idx = geomapPanel.layers.length; // since basemap is 0, this looks right
  while (true && idx < 100) {
    const name = `Layer ${idx++}`;
    if (!geomapPanel.byName.has(name)) {
      return name;
    }
  }

  return `Layer ${Date.now()}`;
};
