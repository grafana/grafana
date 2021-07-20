import { FrameGeometrySourceMode, PanelPlugin } from '@grafana/data';
import { BaseLayerEditor } from './editor/BaseLayerEditor';
import { DataLayersEditor } from './editor/DataLayersEditor';
import { GeomapPanel } from './GeomapPanel';
import { MapViewEditor } from './editor/MapViewEditor';
import { defaultView, GeomapPanelOptions } from './types';
import { mapPanelChangedHandler } from './migrations';
import { defaultGrafanaThemedMap } from './layers/basemaps';
import { MARKERS_LAYER_ID } from './layers/data/markersLayer';

export const plugin = new PanelPlugin<GeomapPanelOptions>(GeomapPanel)
  .setNoPadding()
  .setPanelChangeHandler(mapPanelChangedHandler)
  .useFieldConfig()
  .setPanelOptions((builder) => {
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

    // Nested
    builder.addCustomEditor({
      category: ['Base Layer'],
      id: 'basemap',
      path: 'basemap',
      name: 'Base Layer',
      editor: BaseLayerEditor,
      defaultValue: {
        type: defaultGrafanaThemedMap.id,
        config: defaultGrafanaThemedMap.defaultOptions,
      },
    });

    builder.addCustomEditor({
      category: ['Data Layer'],
      id: 'layers',
      path: 'layers',
      name: 'Data Layer',
      editor: DataLayersEditor,
      defaultValue: [
        {
          type: MARKERS_LAYER_ID,
          config: {},
          location: {
            mode: FrameGeometrySourceMode.Auto,
          },
        },
      ],
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
        path: 'controls.mouseWheelZoom',
        name: 'Mouse wheel zoom',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showLegend',
        name: 'Show legend',
        description: 'Show legend',
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
