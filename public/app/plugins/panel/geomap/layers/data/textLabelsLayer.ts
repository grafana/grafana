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
  getTextDimension,
  TextDimensionConfig,
  TextDimensionMode,
} from 'app/features/dimensions';
import tinycolor from 'tinycolor2';
import { ColorDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';
import { Fill, Stroke } from 'ol/style';

interface TextLabelsConfig {
  labelText: TextDimensionConfig;
  color: ColorDimensionConfig;
  fillOpacity: number;
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
  fillOpacity: 0.4,
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

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return;
        }

        const features: Feature<Point>[] = [];

        const getTextStyle = (text: string, fillColor: string) => {
          return new style.Text({
            text: text,
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: fillColor }),
          });
        };

        const getStyle = (text: string, fillColor: string) => {
          return new style.Style({
            text: getTextStyle(text, fillColor),
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
          const opacity = options.config?.fillOpacity ?? defaultOptions.fillOpacity;

          // Map each data value into new points
          for (let i = 0; i < frame.length; i++) {
            // Get the color for the feature based on color scheme
            const color = colorDim.get(i);
            // Get the text for the feature based on text dimension
            const label = textDim.get(i);

            // Set the opacity determined from user configuration
            const fillColor = tinycolor(color).setAlpha(opacity).toRgbString();

            // Create a new Feature for each point returned from dataFrameToPoints
            const dot = new Feature(info.points[i]);
            dot.setProperties({
              frame,
              rowIndex: i,
            });
            dot.setStyle(getStyle(label, fillColor));
            features.push(dot);
          }
        }

        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },
    };
  },
  // Marker overlay options
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
      });
  },
  defaultOptions,
};
