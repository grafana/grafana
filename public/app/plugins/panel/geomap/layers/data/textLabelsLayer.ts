import { GrafanaTheme2, MapLayerOptions, MapLayerRegistryItem, PanelData, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import {
  ColorDimensionConfig,
  getColorDimension,
  getScaledDimension,
  getTextDimension,
  ScaleDimensionConfig,
  TextDimensionConfig,
  TextDimensionMode,
} from 'app/features/dimensions';
import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';
import { Fill, Stroke } from 'ol/style';
import { FeaturesStylesBuilderConfig, getFeatures } from '../../utils/getFeatures';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { StyleMaker, StyleMakerConfig } from '../../types';

interface TextLabelsConfig {
  labelText: TextDimensionConfig;
  color: ColorDimensionConfig;
  fillOpacity: number;
  fontSize: ScaleDimensionConfig;
}

export const TEXT_LABELS_LAYER = 'text-labels';

const defaultOptions: TextLabelsConfig = {
  labelText: {
    fixed: '',
    mode: TextDimensionMode.Field,
  },
  color: {
    fixed: 'dark-blue',
  },
  fillOpacity: 0.6,
  fontSize: {
    fixed: 10,
    min: 5,
    max: 100,
  },
};

export const textLabelsLayer: MapLayerRegistryItem<TextLabelsConfig> = {
  id: TEXT_LABELS_LAYER,
  name: 'Text labels',
  description: 'render text labels',
  isBaseMap: false,
  state: PluginState.alpha,
  showLocation: true,

  create: async (map: Map, options: MapLayerOptions<TextLabelsConfig>, theme: GrafanaTheme2) => {
    const matchers = await getLocationMatchers(options.location);
    const vectorLayer = new layer.Vector({});

    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const fontFamily = theme.typography.fontFamily;

    const getTextStyle = (text: string, fillColor: string, fontSize: number) => {
      return new style.Text({
        text: text,
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color: fillColor }),
        font: `normal ${fontSize}px ${fontFamily}`,
      });
    };

    const getStyle: StyleMaker = (cfg: StyleMakerConfig) => {
      return new style.Style({
        text: getTextStyle(cfg.text ?? defaultOptions.labelText.fixed, cfg.fillColor, cfg.size),
      });
    };

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return;
        }

        const features: Feature<Point>[] = [];

        for (const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if (info.warning) {
            console.log('Could not find locations', info.warning);
            return;
          }

          const colorDim = getColorDimension(frame, config.color, theme);
          const textDim = getTextDimension(frame, config.labelText);
          const sizeDim = getScaledDimension(frame, config.fontSize);
          const opacity = options.config?.fillOpacity ?? defaultOptions.fillOpacity;

          const featureDimensionConfig: FeaturesStylesBuilderConfig = {
            colorDim: colorDim,
            sizeDim: sizeDim,
            textDim: textDim,
            opacity: opacity,
            styleMaker: getStyle,
          };

          const frameFeatures = getFeatures(frame, info, featureDimensionConfig);

          if (frameFeatures) {
            features.push(...frameFeatures);
          }
        }

        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.labelText',
            name: 'Text label',
            path: 'config.labelText',
            editor: TextDimensionEditor,
          })
          .addCustomEditor({
            id: 'config.color',
            path: 'config.color',
            name: 'Text color',
            editor: ColorDimensionEditor,
            settings: {},
          })
          .addSliderInput({
            path: 'config.fillOpacity',
            name: 'Text opacity',
            defaultValue: defaultOptions.fillOpacity,
            settings: {
              min: 0,
              max: 1,
              step: 0.1,
            },
          })
          .addCustomEditor({
            id: 'config.fontSize',
            path: 'config.fontSize',
            name: 'Text size',
            editor: ScaleDimensionEditor,
            settings: {
              fixed: defaultOptions.fontSize.fixed,
              min: defaultOptions.fontSize.min,
              max: defaultOptions.fontSize.max,
            },
          });
      },
    };
  },
  defaultOptions,
};
