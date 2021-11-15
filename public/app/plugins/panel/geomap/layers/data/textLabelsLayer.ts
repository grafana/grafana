import { GrafanaTheme2, MapLayerOptions, MapLayerRegistryItem, PanelData, PluginState } from '@grafana/data';
import Map from 'ol/Map';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getColorDimension, getScaledDimension, getTextDimension, TextDimensionMode } from 'app/features/dimensions';
import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';
import { FeaturesStylesBuilderConfig, getFeatures } from '../../utils/getFeatures';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { textMarkerMaker } from '../../style/text';
import { MarkersConfig } from './markersLayer';
import { StyleEditor } from './StyleEditor';

export const TEXT_LABELS_LAYER = 'text-labels';

// Same configuration
type TextLabelsConfig = MarkersConfig;

const defaultOptions = {
  style: {
    text: {
      fixed: '',
      mode: TextDimensionMode.Field,
    },
    color: {
      fixed: 'dark-blue',
    },
    opacity: 1,
    size: {
      fixed: 10,
      min: 5,
      max: 100,
    },
  },
  showLegend: false,
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

        const style = config.style ?? defaultOptions.style;

        for (const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if (info.warning) {
            console.log('Could not find locations', info.warning);
            return;
          }

          const colorDim = getColorDimension(frame, style.color ?? defaultOptions.style.color, theme);
          const sizeDim = getScaledDimension(frame, style.size ?? defaultOptions.style.size);
          const opacity = style?.opacity ?? defaultOptions.style.opacity;
          const textDim = getTextDimension(frame, style.text ?? defaultOptions.style.text);

          const featureDimensionConfig: FeaturesStylesBuilderConfig = {
            colorDim: colorDim,
            sizeDim: sizeDim,
            textDim: textDim,
            opacity: opacity,
            styleMaker: textMarkerMaker,
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
        builder.addCustomEditor({
          id: 'config.style',
          path: 'config.style',
          name: 'Styles',
          editor: StyleEditor,
          settings: {},
          defaultValue: defaultOptions.style,
        });
      },
    };
  },
  defaultOptions,
};
