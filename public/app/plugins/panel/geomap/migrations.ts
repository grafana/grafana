import { FieldConfigSource, PanelModel, PanelTypeChangedHandler, Threshold, ThresholdsMode } from '@grafana/data';
import { GeomapPanelOptions } from './types';
import { markerMakers } from './utils/regularShapes';
import { MapCenterID } from './view';

/**
 * This is called when the panel changes from another panel
 */
export const mapPanelChangedHandler: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions, prevFieldConfig) => {
  // Changing from angular/worldmap panel to react/openlayers
  if (prevPluginId === 'grafana-worldmap-panel' && prevOptions.angular) {
    const { fieldConfig, options } = worldmapToGeomapOptions({
      ...prevOptions.angular,
      fieldConfig: prevFieldConfig,
    });
    panel.fieldConfig = fieldConfig; // Mutates the incoming panel
    return options;
  }

  return {};
};

export function worldmapToGeomapOptions(angular: any): { fieldConfig: FieldConfigSource; options: GeomapPanelOptions } {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const options: GeomapPanelOptions = {
    view: {
      id: MapCenterID.Zero,
    },
    controls: {
      showZoom: true,
      mouseWheelZoom: Boolean(angular.mouseWheelZoom),
    },
    basemap: {
      type: 'default', // was carto
    },
    layers: [
      // TODO? depends on current configs
    ],
  };

  let v = asNumber(angular.decimals);
  if (v) {
    fieldConfig.defaults.decimals = v;
  }

  // Convert thresholds and color values
  if (angular.thresholds && angular.colors) {
    const levels = angular.thresholds.split(',').map((strVale: string) => {
      return Number(strVale.trim());
    });

    // One more color than threshold
    const thresholds: Threshold[] = [];
    for (const color of angular.colors) {
      const idx = thresholds.length - 1;
      if (idx >= 0) {
        thresholds.push({ value: levels[idx], color });
      } else {
        thresholds.push({ value: -Infinity, color });
      }
    }

    fieldConfig.defaults.thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: thresholds,
    };
  }

  v = asNumber(angular.initialZoom);
  if (v) {
    options.view.zoom = v;
  }

  // mapCenter: 'Europe',
  // mapCenterLatitude: 46,
  // mapCenterLongitude: 14,
  //
  // Map center (from worldmap)
  const mapCenters: any = {
    '(0°, 0°)': MapCenterID.Zero,
    'North America': 'north-america',
    Europe: 'europe',
    'West Asia': 'west-asia',
    'SE Asia': 'se-asia',
    'Last GeoHash': MapCenterID.Coordinates, // MapCenterID.LastPoint,
  };
  options.view.id = mapCenters[angular.mapCenter as any];
  options.view.lat = asNumber(angular.mapCenterLatitude);
  options.view.lon = asNumber(angular.mapCenterLongitude);
  return { fieldConfig, options };
}

function asNumber(v: any): number | undefined {
  const num = +v;
  return isNaN(num) ? undefined : num;
}

export const mapMigrationHandler = (panel: PanelModel): Partial<GeomapPanelOptions> => {
  const pluginVersion = panel?.pluginVersion;
  if (pluginVersion?.startsWith('8.1') || pluginVersion?.startsWith('8.2') || pluginVersion?.startsWith('8.3')) {
    if (panel.options?.layers?.length > 0) {
      const layer = panel.options.layers[0];
      if (layer?.type === 'markers') {
        const shape = layer?.config?.shape;
        if (shape) {
          const marker = markerMakers.getIfExists(shape);
          if (marker?.aliasIds && marker.aliasIds?.length > 0) {
            layer.config.markerSymbol = {
              fixed: marker.aliasIds[0],
              mode: 'fixed',
            };
            delete layer.config.shape;
          }
          return { ...panel.options, layers: Object.assign([], ...panel.options.layers, { 0: layer }) };
        }
      }
    }
  }
  return panel.options;
};
