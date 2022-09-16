import { Map as OpenLayersMap } from 'ol';
import { defaults as interactionDefaults } from 'ol/interaction';

import { SelectableValue } from '@grafana/data';
import { DataFrame, GrafanaTheme2 } from '@grafana/data/src';
import { getColorDimension, getScalarDimension, getScaledDimension, getTextDimension } from 'app/features/dimensions';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';

import { GeomapPanel } from '../GeomapPanel';
import { defaultStyleConfig, StyleConfig, StyleConfigState, StyleDimensions } from '../style/types';
import { GeomapPanelOptions, MapLayerState } from '../types';

import { initMapView } from './view';

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

export const getNewOpenLayersMap = (panel: GeomapPanel, options: GeomapPanelOptions, div: HTMLDivElement) => {
  const [view] = initMapView(options.view, undefined, undefined);
  return (panel.map = new OpenLayersMap({
    view: view,
    pixelRatio: 1, // or zoom?
    layers: [], // loaded explicitly below
    controls: [],
    target: div,
    interactions: interactionDefaults({
      mouseWheelZoom: false, // managed by initControls
    }),
  }));
};

export const updateMap = (panel: GeomapPanel, options: GeomapPanelOptions) => {
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
    const name = `Layer ${idx++}`;
    if (!panel.byName.has(name)) {
      return name;
    }
  }

  return `Layer ${Date.now()}`;
};
