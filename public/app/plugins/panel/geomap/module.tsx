import { PanelPlugin } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { commonOptionsBuilder } from '@grafana/ui';

import { GeomapPanel } from './GeomapPanel';
import { LayersEditor } from './editor/LayersEditor';
import { MapViewEditor } from './editor/MapViewEditor';
import { getLayerEditor } from './editor/layerEditor';
import { mapPanelChangedHandler, mapMigrationHandler } from './migrations';
import { defaultMapViewConfig, Options, TooltipMode, GeomapInstanceState } from './types';

export const plugin = new PanelPlugin<Options>(GeomapPanel)
  .setNoPadding()
  .setPanelChangeHandler(mapPanelChangedHandler)
  .setMigrationHandler(mapMigrationHandler)
  .useFieldConfig({
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder, context) => {
    let category = [t('geomap.category-map-view', 'Map view')];
    builder.addCustomEditor({
      category,
      id: 'view',
      path: 'view',
      name: t('geomap.name-initial-view', 'Initial view'), // don't show it
      description: t('geomap.description-initial-view', 'This location will show when the panel first loads.'),
      editor: MapViewEditor,
      defaultValue: defaultMapViewConfig,
    });

    builder.addBooleanSwitch({
      category,
      path: 'view.shared',
      description: t(
        'geomap.description-share-view',
        'Use the same view across multiple panels.  Note: this may require a dashboard reload.'
      ),
      name: t('geomap.name-share-view', 'Share view'),
      defaultValue: defaultMapViewConfig.shared,
    });

    builder.addBooleanSwitch({
      category,
      path: 'view.noRepeat',
      name: t('geomap.name-no-repeat', 'No map repeating'),
      description: t('geomap.description-no-repeat', 'Prevent the map from repeating horizontally'),
      defaultValue: false,
    });

    // eslint-disable-next-line
    const state = context.instanceState as GeomapInstanceState;
    if (!state?.layers) {
      // TODO? show spinner?
    } else {
      const layersCategory = [t('geomap.category-map-layers', 'Map layers')];
      const basemapCategory = [t('geomap.category-basemap-layer', 'Basemap layer')];
      builder.addCustomEditor({
        category: layersCategory,
        id: 'layers',
        path: '',
        name: '',
        editor: LayersEditor,
      });

      const selected = state.layers[state.selected];
      if (state.selected && selected) {
        builder.addNestedOptions(
          getLayerEditor({
            state: selected,
            category: layersCategory,
            basemaps: false,
          })
        );
      }

      const baselayer = state.layers[0];
      if (config.geomapDisableCustomBaseLayer) {
        builder.addCustomEditor({
          category: basemapCategory,
          id: 'layers',
          path: '',
          name: '',

          editor: () => (
            <div>
              <Trans i18nKey="geomap.plugin.basemap-layer-configured-server-admin">
                The basemap layer is configured by the server admin.
              </Trans>
            </div>
          ),
        });
      } else if (baselayer) {
        builder.addNestedOptions(
          getLayerEditor({
            state: baselayer,
            category: basemapCategory,
            basemaps: true,
          })
        );
      }
    }

    // The controls section
    category = [t('geomap.category-map-controls', 'Map controls')];
    builder
      .addBooleanSwitch({
        category,
        path: 'controls.showZoom',
        description: t('geomap.description-show-zoom', 'Show zoom control buttons in the upper left corner'),
        name: t('geomap.name-show-zoom', 'Show zoom control'),
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.mouseWheelZoom',
        description: t('geomap.description-mouse-wheel-zoom', 'Enable zoom control via mouse wheel'),
        name: t('geomap.name-mouse-wheel-zoom', 'Mouse wheel zoom'),
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showAttribution',
        name: t('geomap.name-show-attribution', 'Show attribution'),
        description: t(
          'geomap.description-show-attribution',
          'Show the map source attribution info in the lower right'
        ),
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showScale',
        name: t('geomap.name-show-scale', 'Show scale'),
        description: t('geomap.description-show-scale', 'Indicate map scale'),
        defaultValue: false,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showMeasure',
        name: t('geomap.name-show-measure', 'Show measure tools'),
        description: t('geomap.description-show-measure', 'Show tools for making measurements on the map'),
        defaultValue: false,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showDebug',
        name: t('geomap.name-show-debug', 'Show debug'),
        description: t('geomap.description-show-debug', 'Show map info'),
        defaultValue: false,
      })
      .addRadio({
        category,
        path: 'tooltip.mode',
        name: t('geomap.name-tooltip', 'Tooltip'),
        defaultValue: TooltipMode.Details,
        settings: {
          options: [
            {
              label: t('geomap.tooltip-options.label-none', 'None'),
              value: TooltipMode.None,
              description: t('geomap.tooltip-options.description-none', 'Show contents on click, not hover'),
            },
            {
              label: t('geomap.tooltip-options.label-details', 'Details'),
              value: TooltipMode.Details,
              description: t('geomap.tooltip-options.description-details', 'Show popup on hover'),
            },
          ],
        },
      });
  });
