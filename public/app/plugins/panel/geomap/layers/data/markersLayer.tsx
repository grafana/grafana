import React, { ReactNode } from 'react';
import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
} from '@grafana/data';
import Map from 'ol/Map';
import Feature, { FeatureLike } from 'ol/Feature';
import { Point } from 'ol/geom';
import * as source from 'ol/source';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getScaledDimension, getColorDimension, getTextDimension, getScalarDimension } from 'app/features/dimensions';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { MarkersLegend, MarkersLegendProps } from './MarkersLegend';
import { ReplaySubject } from 'rxjs';
import { getFeatures } from '../../utils/getFeatures';
import { defaultStyleConfig, StyleConfig, StyleDimensions } from '../../style/types';
import { StyleEditor } from './StyleEditor';
import { getStyleConfigState } from '../../style/utils';
import VectorLayer from 'ol/layer/Vector';
import { isNumber } from 'lodash';

// Configuration options for Circle overlays
export interface MarkersConfig {
  style: StyleConfig;
  showLegend?: boolean;
}

const defaultOptions: MarkersConfig = {
  style: defaultStyleConfig,
  showLegend: true,
};

export const MARKERS_LAYER_ID = 'markers';

// Used by default when nothing is configured
export const defaultMarkersConfig: MapLayerOptions<MarkersConfig> = {
  type: MARKERS_LAYER_ID,
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
export const markersLayer: MapLayerRegistryItem<MarkersConfig> = {
  id: MARKERS_LAYER_ID,
  name: 'Markers',
  description: 'use markers to render each data point',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<MarkersConfig>, theme: GrafanaTheme2) => {
    const matchers = await getLocationMatchers(options.location);
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    const style = await getStyleConfigState(config.style);

    // eventually can also use resolution for dynamic style
    const vectorLayer = new VectorLayer();

    if(!style.fields) {
      // Set a global style
      vectorLayer.setStyle(style.maker(style.base));
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const idx = feature.get("rowIndex") as number;
        const dims = style.dims;
        if(!dims || !(isNumber(idx))) {
          return style.maker(style.base);
        }

        const values = {...style.base};

        if (dims.color) {
          values.color = dims.color.get(idx);
        }
        if (dims.size) {
          values.size = dims.size.get(idx);
        }
        if (dims.text) {
          values.text = dims.text.get(idx);
        }
        if (dims.rotation) {
          values.rotation = dims.rotation.get(idx);
        }
        return style.maker(values)
      }
      );
    }
    
    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return; // ignore empty
        }

        const features: Feature<Point>[] = [];

        for (const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if (info.warning) {
            console.log('Could not find locations', info.warning);
            continue; // ???
          }

          if (style.fields) {
            const dims: StyleDimensions = {};
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
            style.dims = dims;
          }

          const frameFeatures = getFeatures(frame, info);

          if (frameFeatures) {
            features.push(...frameFeatures);
          }

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              color: style.dims?.color,
              size: style.dims?.size,
            });
          }
          break; // Only the first frame for now!
        }

        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
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
            description: 'Show legend',
            defaultValue: defaultOptions.showLegend,
          });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
