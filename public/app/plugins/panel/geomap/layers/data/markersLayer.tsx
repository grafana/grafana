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
import * as style from 'ol/style';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import {
  ColorDimensionConfig,
  ScaleDimensionConfig,
  getScaledDimension,
  getColorDimension,
  ResourceDimensionConfig,
  ResourceDimensionMode,
  ResourceFolderName,
  getPublicOrAbsoluteUrl,
} from 'app/features/dimensions';
import { ScaleDimensionEditor, ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { MarkersLegend, MarkersLegendProps } from './MarkersLegend';
import { getMarkerFromPath } from '../../utils/regularShapes';
import { ReplaySubject } from 'rxjs';
import { FeaturesStylesBuilderConfig, getFeatures } from '../../utils/getFeatures';
import { StyleMaker, StyleMakerConfig } from '../../types';
import { getSVGUri } from '../../utils/prepareSVG';

// Configuration options for Circle overlays
export interface MarkersConfig {
  size: ScaleDimensionConfig;
  color: ColorDimensionConfig;
  fillOpacity: number;
  showLegend?: boolean;
  markerSymbol: ResourceDimensionConfig;
}

const DEFAULT_SIZE = 5;

const defaultOptions: MarkersConfig = {
  size: {
    fixed: DEFAULT_SIZE,
    min: 2,
    max: 15,
  },
  color: {
    fixed: 'dark-green', // picked from theme
  },
  fillOpacity: 0.4,
  showLegend: true,
  markerSymbol: {
    mode: ResourceDimensionMode.Fixed,
    fixed: 'img/icons/marker/circle.svg',
  },
};

export const MARKERS_LAYER_ID = 'markers';

// Used by default when nothing is configured
export const defaultMarkersConfig: MapLayerOptions<MarkersConfig> = {
  type: MARKERS_LAYER_ID,
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

    const markerPath =
      getPublicOrAbsoluteUrl(config.markerSymbol?.fixed) ?? getPublicOrAbsoluteUrl('img/icons/marker/circle.svg');
    // double to match regularshapes using size as radius
    const uri = await getSVGUri(markerPath, config.size.fixed * 2);

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return; // ignore empty
        }

        const makeIconStyle = (cfg: StyleMakerConfig) => {
          const icon = new style.Style({
            image: new style.Icon({
              src: uri,
              color: cfg.color,
              opacity: cfg.opacity,
              // scale based on field value
              scale: (DEFAULT_SIZE + cfg.size) / 100,
            }),
          });
          // transparent bounding box for featureAtPixel detection
          const boundingBox = new style.Style({
            image: new style.RegularShape({
              fill: new style.Fill({ color: 'rgba(0,0,0,0)' }),
              points: 4,
              radius: cfg.size,
              angle: Math.PI / 4,
            }),
          });
          return [icon, boundingBox]
        };

        const marker = getMarkerFromPath(config.markerSymbol?.fixed);

        const shape: StyleMaker = marker?.make ?? makeIconStyle;

        const features: Feature<Point>[] = [];

        for (const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if (info.warning) {
            console.log('Could not find locations', info.warning);
            continue; // ???
          }

          const colorDim = getColorDimension(frame, config.color, theme);
          const sizeDim = getScaledDimension(frame, config.size);
          const opacity = options.config?.fillOpacity ?? defaultOptions.fillOpacity;

          const featureDimensionConfig: FeaturesStylesBuilderConfig = {
            colorDim: colorDim,
            sizeDim: sizeDim,
            opacity: opacity,
            styleMaker: shape,
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
            id: 'config.size',
            path: 'config.size',
            name: 'Marker Size',
            editor: ScaleDimensionEditor,
            settings: {
              min: 1,
              max: 100, // possible in the UI
            },
            defaultValue: {
              // Configured values
              fixed: DEFAULT_SIZE,
              min: 1,
              max: 20,
            },
          })
          .addCustomEditor({
            id: 'config.markerSymbol',
            path: 'config.markerSymbol',
            name: 'Marker Symbol',
            editor: ResourceDimensionEditor,
            defaultValue: defaultOptions.markerSymbol,
            settings: {
              resourceType: 'icon',
              showSourceRadio: false,
              folderName: ResourceFolderName.Marker,
            },
          })
          .addCustomEditor({
            id: 'config.color',
            path: 'config.color',
            name: 'Marker Color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
              // Configured values
              fixed: 'grey',
            },
          })
          .addSliderInput({
            path: 'config.fillOpacity',
            name: 'Fill opacity',
            defaultValue: defaultOptions.fillOpacity,
            settings: {
              min: 0,
              max: 1,
              step: 0.1,
            },
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
