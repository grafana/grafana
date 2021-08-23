import React from 'react';
import { PanelPlugin } from '@grafana/data';
import { GeomapPanel } from './GeomapPanel';
import { MapViewEditor } from './editor/MapViewEditor';
import { defaultView, GeomapPanelOptions } from './types';
import { mapPanelChangedHandler } from './migrations';
import { defaultMarkersConfig } from './layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG } from './layers/registry';
import { get as lodashGet } from 'lodash';
import { config } from 'app/core/config';
import { addMapLayerEditors } from './editor/LayerEditor';

export const plugin = new PanelPlugin<GeomapPanelOptions>(GeomapPanel)
  .setNoPadding()
  .setPanelChangeHandler(mapPanelChangedHandler)
  .useFieldConfig()
  .setPanelOptions((builder, current) => {
    // When either basemap or layers change re-run this funciton
    builder.setDependencies(['basemap', 'layers']);

    let category = ['Map View'];
    builder.addCustomEditor({
      category,
      id: 'view',
      path: 'view',
      name: 'Initial view', // don't show it
      description: 'This location will show when the panel first loads',
      editor: MapViewEditor,
      defaultValue: defaultView,
    });

    builder.addBooleanSwitch({
      category,
      path: 'view.shared',
      description: 'Use the same view across multiple panels.  Note: this may require a dashboard reload.',
      name: 'Share view',
      defaultValue: defaultView.shared,
    });

    if (config.geomapDisableCustomBaseLayer) {
      builder.addCustomEditor({
        category: ['Base Layer'],
        id: 'basemap',
        path: 'basemap',
        name: 'Base Layer',
        // eslint-disable-next-line react/display-name
        editor: () => {
          return <div>The base layer is configured by the server admin.</div>;
        },
        defaultValue: DEFAULT_BASEMAP_CONFIG,
      });
    } else {
      // Append the basemap prefix
      builder.setDefaultConfig({
        category: ['Base Layer'],
        beforeChange: ({ path, value }) => {
          return { path: `basemap.${path}`, value };
        },
        valueGetter: (root: any, path: string) => {
          return lodashGet(root, `basemap.${path}`);
        },
      });

      addMapLayerEditors(
        builder,
        current?.basemap ?? DEFAULT_BASEMAP_CONFIG,
        true, // only basemaps
        (value) => ({
          path: 'basemap',
          value,
        })
      );

      // Append the basemap prefix
      builder.setDefaultConfig({
        category: ['Data Layer'],
        beforeChange: ({ path, value }) => {
          console.log('TODO!!!!!!!!!', { path, value });
          return { path: `layers[0].${path}`, value }; // :(
        },
        valueGetter: (root: GeomapPanelOptions, path: string) => {
          if (!root.layers) {
            return undefined;
          }
          const layer = root.layers[0];
          return lodashGet(layer, path);
        },
      });

      addMapLayerEditors(
        builder,
        current?.basemap ?? defaultMarkersConfig,
        false, // not basemaps
        (value) => ({
          path: 'basemap',
          value,
        })
      );

      builder.setDefaultConfig(undefined);
    }

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
        path: 'controls.mouseWheelZoom',
        name: 'Mouse wheel zoom',
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
