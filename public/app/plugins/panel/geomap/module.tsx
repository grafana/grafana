import { PanelPlugin } from '@grafana/data';
import { BaseLayerEditor } from './editor/BaseLayerEditor';
import { DataLayersEditor } from './editor/DataLayersEditor';
import { GeomapPanel } from './GeomapPanel';
import { MapViewEditor } from './MapViewEditor';
import { GeomapPanelOptions } from './types';

export const plugin = new PanelPlugin<GeomapPanelOptions>(GeomapPanel)
  .setNoPadding()
  .useFieldConfig()
  .setPanelOptions((builder) => {
    // Nested
    builder.addCustomEditor({
      category: ['Map View'],
      id: 'view',
      path: 'view',
      name: 'Map View',
      editor: MapViewEditor,
    });

    builder.addCustomEditor({
      category: ['Base Layer'],
      id: 'basemap',
      path: 'basemap',
      name: 'Base Layer',
      editor: BaseLayerEditor,
    });

    // Data layer section
    let category = ['Data Layer'];
    builder
      .addCustomEditor({
        category: ['Data Layer'],
        id: 'layers',
        path: 'layers',
        name: 'Data Layer',
        editor: DataLayersEditor,
      })
      .addSelect({
        category,
        path: 'layers[0].config.fieldMapping.queryFormat',
        name: 'Query Format',
        defaultValue: 'coordinates',
        settings: {
          options: [
            {
              value: 'coordinates',
              label: 'Coordinates',
            },
            {
              value: 'geohash',
              label: 'Geohash',
            },
          ],
        },
        showIf: (config) => config.layers[0].type === 'worldmap-behavior',
      })
      .addTextInput({
        category,
        path: 'layers[0].config.fieldMapping.metricField',
        name: 'Metric Field',
        defaultValue: '',
        showIf: (config) => config.layers[0].type === 'worldmap-behavior',
      })
      .addTextInput({
        category,
        path: 'layers[0].config.fieldMapping.latitudeField',
        name: 'Latitude Field',
        defaultValue: '',
        showIf: (config) =>
          config.layers[0].config?.fieldMapping.queryFormat === 'coordinates' &&
          config.layers[0].type === 'worldmap-behavior',
      })
      .addTextInput({
        category,
        path: 'layers[0].config.fieldMapping.longitudeField',
        name: 'Longitude Field',
        defaultValue: '',
        showIf: (config) =>
          config.layers[0].config?.fieldMapping.queryFormat === 'coordinates' &&
          config.layers[0].type === 'worldmap-behavior',
      })
      .addTextInput({
        category,
        path: 'layers[0].config.fieldMapping.geohashField',
        name: 'Geohash Field',
        defaultValue: '',
        showIf: (config) =>
          config.layers[0].config?.fieldMapping.queryFormat === 'geohash' &&
          config.layers[0].type === 'worldmap-behavior',
      });

    // The controls section
    category = ['Map Controls'];
    builder
      .addBooleanSwitch({
        category,
        path: 'controls.showZoom',
        description: 'show buttons in the upper left',
        name: 'Show zoom control',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showAttribution',
        name: 'Show attribution',
        description: 'Show the map source attribution info in the lower right',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showScale',
        name: 'Show scale',
        description: 'Indicate map scale',
        defaultValue: false,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showDebug',
        name: 'Show debug',
        description: 'show map info',
        defaultValue: false,
      });
  });
