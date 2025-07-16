import Feature from 'ol/Feature';
import OpenLayersMap from 'ol/Map';
import Geometry from 'ol/geom/Geometry';
import Point from 'ol/geom/Point';
import { defaults as interactionDefaults } from 'ol/interaction';
import BaseLayer from 'ol/layer/Base';
import LayerGroup from 'ol/layer/Group';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorImage from 'ol/layer/VectorImage';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import ImageSource from 'ol/source/Image';
import TileSource from 'ol/source/Tile';
import VectorSource from 'ol/source/Vector';

import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { getColorDimension } from 'app/features/dimensions/color';
import { getScalarDimension } from 'app/features/dimensions/scalar';
import { getScaledDimension } from 'app/features/dimensions/scale';
import { getTextDimension } from 'app/features/dimensions/text';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';

import { GeomapPanel } from '../GeomapPanel';
import { defaultStyleConfig, StyleConfig, StyleConfigState, StyleDimensions } from '../style/types';
import { Options, MapLayerState } from '../types';

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

/**
 * Checks if an object contains any Grafana template variables
 * @param obj - The object to check for variables
 * @returns true if the object contains any template variables
 */
export const hasVariableDependencies = (obj: object): boolean => {
  return getTemplateSrv().containsTemplate(JSON.stringify(obj));
};

export const getNewOpenLayersMap = (panel: GeomapPanel, options: Options, div: HTMLDivElement) => {
  const view = panel.initMapView(options.view);
  return (panel.map = new OpenLayersMap({
    view: view,
    pixelRatio: window.devicePixelRatio, // or zoom?
    layers: [], // loaded explicitly below
    controls: [],
    target: div,
    interactions: interactionDefaults({
      mouseWheelZoom: false, // managed by initControls
    }),
  }));
};

export const updateMap = (panel: GeomapPanel, options: Options) => {
  panel.initControls(options.controls);
  panel.forceUpdate(); // first render
};

export const notifyPanelEditor = (geomapPanel: GeomapPanel, layers: MapLayerState[], selected: number) => {
  // Notify the panel editor
  if (geomapPanel.panelContext && geomapPanel.panelContext.onInstanceStateChange) {
    geomapPanel.panelContext.onInstanceStateChange({
      map: geomapPanel.map,
      layers: layers,
      selected: selected,
      actions: geomapPanel.actions,
    });
  }
};

export const getNextLayerName = (panel: GeomapPanel) => {
  let idx = panel.layers.length; // since basemap is 0, this looks right
  while (true && idx < 100) {
    const name = t('geomap.utils.get-next-layer-name', 'Layer {{name}}', { name: idx++ });
    if (!panel.byName.has(name)) {
      return name;
    }
  }

  return t('geomap.utils.get-next-layer-name', 'Layer {{name}}', { name: Date.now() });
};

export function isSegmentVisible(
  map: OpenLayersMap,
  pixelTolerance: number,
  segmentStartCoords: number[],
  segmentEndCoords: number[]
): boolean {
  // For a segment, calculate x and y pixel lengths
  //TODO: let's try to find a less intensive check
  const pixelStart = map.getPixelFromCoordinate(segmentStartCoords);
  const pixelEnd = map.getPixelFromCoordinate(segmentEndCoords);
  const deltaX = Math.abs(pixelStart[0] - pixelEnd[0]);
  const deltaY = Math.abs(pixelStart[1] - pixelEnd[1]);
  // If greater than pixel tolerance in either direction, segment is visible
  if (deltaX > pixelTolerance || deltaY > pixelTolerance) {
    return true;
  }
  return false;
}

export const isUrl = (url: string) => {
  try {
    const newUrl = new URL(url);
    return newUrl.protocol.includes('http');
  } catch (_) {
    return false;
  }
};

/**
 * Checks if a layer has data to display
 * @param layer The OpenLayers layer to check
 * @returns boolean indicating if the layer has data
 */
export function hasLayerData(
  layer:
    | LayerGroup
    | VectorLayer<VectorSource<Feature<Geometry>>>
    | VectorImage<VectorSource<Feature<Geometry>>>
    | WebGLPointsLayer<VectorSource<Feature<Point>>>
    | TileLayer<TileSource>
    | ImageLayer<ImageSource>
    | BaseLayer
): boolean {
  if (layer instanceof LayerGroup) {
    return layer
      .getLayers()
      .getArray()
      .some((subLayer) => hasLayerData(subLayer));
  }
  if (layer instanceof VectorLayer || layer instanceof VectorImage) {
    const source = layer.getSource();
    return source != null && source.getFeatures().length > 0;
  }
  if (layer instanceof WebGLPointsLayer) {
    const source = layer.getSource();
    return source != null && source.getFeatures().length > 0;
  }
  if (layer instanceof TileLayer || layer instanceof ImageLayer) {
    // For tile/image layers, check if they have a source
    return Boolean(layer.getSource());
  }
  return false;
}
