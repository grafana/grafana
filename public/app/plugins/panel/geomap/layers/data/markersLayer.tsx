import React, { ReactNode } from 'react';
import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
} from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getScaledDimension, getColorDimension, getTextDimension } from 'app/features/dimensions';
import { TextDimensionEditor } from 'app/features/dimensions/editors';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { MarkersLegend, MarkersLegendProps } from './MarkersLegend';
import { ReplaySubject } from 'rxjs';
import { FeaturesStylesBuilderConfig, getFeatures } from '../../utils/getFeatures';
import { getMarkerMaker } from '../../style/markers';
import { defaultStyleConfig, StyleConfig, TextAlignment, TextBaseline } from '../../style/types';
import { StyleEditor } from './StyleEditor';

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
    const vectorLayer = new layer.Vector({});
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

    const style = config.style ?? defaultStyleConfig;
    const markerMaker = await getMarkerMaker(style.symbol?.fixed);

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

          const colorDim = getColorDimension(frame, style.color ?? defaultStyleConfig.color, theme);
          const sizeDim = getScaledDimension(frame, style.size ?? defaultStyleConfig.size);
          const textDim = style?.text && getTextDimension(frame, style.text);
          const opacity = style?.opacity ?? defaultStyleConfig.opacity;

          const featureDimensionConfig: FeaturesStylesBuilderConfig = {
            colorDim: colorDim,
            sizeDim: sizeDim,
            textDim: textDim,
            textConfig: style?.textConfig,
            opacity: opacity,
            styleMaker: markerMaker,
          };

          const frameFeatures = getFeatures(frame, info, featureDimensionConfig);

          if (frameFeatures) {
            features.push(...frameFeatures);
          }

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              color: colorDim,
              size: sizeDim,
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
            settings: {},
            defaultValue: defaultOptions.style,
          })
          .addCustomEditor({
            id: 'config.style.text',
            path: 'config.style.text',
            name: 'Text label',
            editor: TextDimensionEditor,
            defaultValue: defaultOptions.style.text,
          })
          .addNumberInput({
            name: 'Text font size',
            path: 'config.style.textConfig.fontSize',
            defaultValue: defaultOptions.style.textConfig?.fontSize,
          })
          .addNumberInput({
            name: 'Text X offset',
            path: 'config.style.textConfig.offsetX',
            defaultValue: 0,
          })
          .addNumberInput({
            name: 'Text Y offset',
            path: 'config.style.textConfig.offsetY',
            defaultValue: 0,
          })
          .addRadio({
            name: 'Text align',
            path: 'config.style.textConfig.textAlign',
            description: '',
            defaultValue: defaultOptions.style.textConfig?.textAlign,
            settings: {
              options: [
                { value: TextAlignment.Left, label: TextAlignment.Left },
                { value: TextAlignment.Center, label: TextAlignment.Center },
                { value: TextAlignment.Right, label: TextAlignment.Right },
              ],
            },
          })
          .addRadio({
            name: 'Text baseline',
            path: 'config.style.textConfig.textBaseline',
            description: '',
            defaultValue: defaultOptions.style.textConfig?.textBaseline,
            settings: {
              options: [
                { value: TextBaseline.Top, label: TextBaseline.Top },
                { value: TextBaseline.Middle, label: TextBaseline.Middle },
                { value: TextBaseline.Bottom, label: TextBaseline.Bottom },
              ],
            },
          })
          // baseline?: 'bottom' | 'top' | 'middle';
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
