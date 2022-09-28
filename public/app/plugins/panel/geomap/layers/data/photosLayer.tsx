import React, { ReactNode } from 'react';
import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  EventBus,
  PluginState,
} from '@grafana/data';
import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { getLocationMatchers } from 'app/features/geo/utils/location';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { MarkersLegend, MarkersLegendProps } from '../../components/MarkersLegend';
import { ReplaySubject } from 'rxjs';
import { defaultImageStyleConfig, StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import VectorLayer from 'ol/layer/Vector';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getStyleDimension} from '../../utils/utils';
import { Stroke, Style } from 'ol/style';
import Photo from 'ol-ext/style/Photo';
import { StyleEditor } from '../../editor/StyleEditor';

// Configuration options for Circle overlays
export interface MarkersConfig {
  style: StyleConfig;
  showLegend?: boolean;
}

const defaultOptions: MarkersConfig = {
  style: defaultImageStyleConfig,
  showLegend: true,
};

export const PHOTOS_LAYER_ID = 'photos';

// Used by default when nothing is configured
export const defaultMarkersConfig: MapLayerOptions<MarkersConfig> = {
  type: PHOTOS_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  },
  tooltip: true,
};

/**
 * Map layer configuration for circle overlay
 */
export const photosLayer: MapLayerRegistryItem<MarkersConfig> = {
  id: PHOTOS_LAYER_ID,
  name: 'Photos',
  description: 'Render photos at each data point',
  isBaseMap: false,
  showLocation: true,
  hideOpacity: true,
  state: PluginState.alpha,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<MarkersConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const location = await getLocationMatchers(options.location);
    console.log(style)  
    const source = new FrameVectorSource(location);
    console.log(source)
    const vectorLayer = new VectorLayer({
      source,
    });

    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    vectorLayer.setStyle((feature: FeatureLike) => {
      const idx = feature.get('rowIndex') as number;
      console.log(feature.get('location'))
      console.log(idx)
      const dims = style.dims;
      console.log(dims)

      const vectorStyle = new Style({
        image: new Photo({
          src: 'http://www2.culture.gouv.fr/Wave/image/memoire/1597/sap40_d0000861_v.jpg',
          radius: 20,
          crop: true,
          kind: 'square',
          stroke: new Stroke({
            width: 2,
            color: '#000'
          })
        })
      });

      return vectorStyle
    });

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }

        for (const frame of data.series) {
          style.dims = getStyleDimension(frame, style, theme);
          console.log(style)

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              styleConfig: style,
              size: style.dims?.size,
              layerName: options.name,
              layer: vectorLayer,
            });
          }
          console.log(frame)
          source.update(frame);
          break; // Only the first frame for now!
        }
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Styles',
            editor: StyleEditor,
            settings: {
              displayRotation: true,
            },
            defaultValue: defaultOptions.style,
          })
          .addBooleanSwitch({
            path: 'config.showLegend',
            name: 'Show legend',
            description: 'Show map legend',
            defaultValue: defaultOptions.showLegend,
          });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
