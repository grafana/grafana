import { GrafanaTheme2, MapLayerOptions, MapLayerRegistryItem, PanelData, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
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
import tinycolor from 'tinycolor2';
import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';
import { Fill, Stroke } from 'ol/style';

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
    fixed: 12,
    min: 8,
    max: 200,
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

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return;
        }

        const features: Feature<Point>[] = [];

        const getTextStyle = (text: string, fillColor: string, fontsize: number) => {
          return new style.Text({
            text: text,
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: fillColor }),
            font: `normal ${fontsize}px ${fontFamily}`,
          });
        };

        const getStyle = (text: string, fillColor: string, fontsize: number) => {
          return new style.Style({
            text: getTextStyle(text, fillColor, fontsize),
          });
        };

        for (const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if (info.warning) {
            console.log('Could not find locations', info.warning);
            return;
          }

          const colorDim = getColorDimension(frame, config.color, theme);
          const textDim = getTextDimension(frame, config.labelText);
          const scaleDim = getScaledDimension(frame, config.fontSize);
          const opacity = options.config?.fillOpacity ?? defaultOptions.fillOpacity;

          // Map each data value into new points
          for (let i = 0; i < frame.length; i++) {
            // Get the color for the feature based on color scheme
            const color = colorDim.get(i);
            const label = textDim.get(i);
            const fontSize = scaleDim.get(i);

            // Set the opacity determined from user configuration
            const fillColor = tinycolor(color).setAlpha(opacity).toRgbString();

            // Create a new Feature for each point returned from dataFrameToPoints
            const dot = new Feature(info.points[i]);
            dot.setProperties({
              frame,
              rowIndex: i,
            });
            dot.setStyle(getStyle(label, fillColor, fontSize));
            features.push(dot);
          }
        }

        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },
    };
  },
  registerOptionsUI: (builder) => {
    builder
      .addCustomEditor({
        id: 'config.labelText',
        name: 'Label text',
        path: 'config.labelText',
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        id: 'config.color',
        path: 'config.color',
        name: 'Label text color',
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
        name: 'Font size',
        editor: ScaleDimensionEditor,
        settings: {
          fixed: defaultOptions.fontSize.fixed,
          min: defaultOptions.fontSize.min,
          max: defaultOptions.fontSize.max,
        },
      });
  },
  defaultOptions,
};
