import { isNumber } from 'lodash';
import { FeatureLike } from 'ol/Feature';
import Map from 'ol/Map';
import { LineString, SimpleGeometry } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { Fill, Style, Text } from 'ol/style';
import FlowLine from 'ol-ext/style/FlowLine';
import React, { ReactNode } from 'react';
import { ReplaySubject } from 'rxjs';
import tinycolor from 'tinycolor2';

import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  EventBus,
  DataFrame,
} from '@grafana/data';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getLocationMatchers } from 'app/features/geo/utils/location';

import { MarkersLegend, MarkersLegendProps } from '../../components/MarkersLegend';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { StyleEditor } from '../../editor/StyleEditor';
import { defaultStyleConfig, StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';

// Configuration options for Circle overlays
export interface NetworkConfig {
  style: StyleConfig;
  showLegend?: boolean;
  edgeStyle: StyleConfig;
  arrow?: 0 | 1 | -1 | 2;
}

const defaultOptions: NetworkConfig = {
  style: defaultStyleConfig,
  showLegend: true,
  edgeStyle: defaultStyleConfig,
  arrow: 0,
};

export const NETWORK_LAYER_ID = 'network';

// Used by default when nothing is configured
export const defaultMarkersConfig: MapLayerOptions<NetworkConfig> = {
  type: NETWORK_LAYER_ID,
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
export const networkLayer: MapLayerRegistryItem<NetworkConfig> = {
  id: NETWORK_LAYER_ID,
  name: 'Network',
  description: 'Render a node graph as a map layer',
  isBaseMap: false,
  showLocation: true,
  hideOpacity: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<NetworkConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const edgeStyle = await getStyleConfigState(config.edgeStyle);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource(location);

    const vectorLayer = new VectorLayer({
      source,
    });
    const hasArrows = config.arrow === 1 || config.arrow === -1 || config.arrow === 2;

    // Add lines between nodes from edges

    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    if (!style.fields && !edgeStyle.fields && !hasArrows) {
      // Set a global style
      vectorLayer.setStyle(style.maker(style.base));
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const geom = feature.getGeometry();
        const idx = feature.get('rowIndex');
        const dims = style.dims;

        // For edges
        if (geom?.getType() === 'LineString' && geom instanceof SimpleGeometry) {
          const edgeDims = edgeStyle.dims;
          const edgeTextConfig = edgeStyle.config.textConfig;
          const edgeId = Number(feature.getId());
          const coordinates = geom.getCoordinates();
          const opacity = edgeStyle.config.opacity ?? 1;
          if (coordinates && edgeDims) {
            const segmentStartCoords = coordinates[0];
            const segmentEndCoords = coordinates[1];
            const color1 = tinycolor(
              theme.visualization.getColorByName((edgeDims.color && edgeDims.color.get(edgeId)) ?? edgeStyle.base.color)
            )
              .setAlpha(opacity)
              .toString();
            const color2 = tinycolor(
              theme.visualization.getColorByName((edgeDims.color && edgeDims.color.get(edgeId)) ?? edgeStyle.base.color)
            )
              .setAlpha(opacity)
              .toString();
            const arrowSize1 = (edgeDims.size && edgeDims.size.get(edgeId)) ?? edgeStyle.base.size;
            const arrowSize2 = (edgeDims.size && edgeDims.size.get(edgeId)) ?? edgeStyle.base.size;
            const styles = [];

            const flowStyle = new FlowLine({
              visible: true,
              lineCap: config.arrow === 0 ? 'round' : 'square',
              color: color1,
              color2: color2,
              width: (edgeDims.size && edgeDims.size.get(edgeId)) ?? edgeStyle.base.size,
              width2: (edgeDims.size && edgeDims.size.get(edgeId)) ?? edgeStyle.base.size,
            });

            if (config.arrow) {
              flowStyle.setArrow(config.arrow);
              if (config.arrow > 0) {
                flowStyle.setArrowColor(color2);
                flowStyle.setArrowSize((arrowSize2 ?? 0) * 2);
              } else {
                flowStyle.setArrowColor(color1);
                flowStyle.setArrowSize((arrowSize1 ?? 0) * 2);
              }
            }
            const LS = new LineString([segmentStartCoords, segmentEndCoords]);
            flowStyle.setGeometry(LS);

            const fontFamily = theme.typography.fontFamily;
            if (edgeDims.text) {
              const labelStyle = new Style({
                text: new Text({
                  text: edgeDims.text.get(edgeId),
                  font: `normal ${edgeTextConfig?.fontSize}px ${fontFamily}`,
                  fill: new Fill({ color: color1 ?? defaultStyleConfig.color.fixed }),
                  ...edgeTextConfig,
                }),
              });
              labelStyle.setGeometry(LS);
              styles.push(labelStyle);
            }
            styles.push(flowStyle);
            return styles;
          }
        }
        if (!dims || !isNumber(idx)) {
          return style.maker(style.base);
        }

        const values = { ...style.base };

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
        return style.maker(values);
      });
    }

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }
        const dataFrames: DataFrame[] = [];
        // TODO find a better way to handle multiple frames
        for (const frame of data.series) {
          dataFrames.push(frame);
          if (frame.refId === 'edges') {
            edgeStyle.dims = getStyleDimension(frame, edgeStyle, theme);
          } else {
            style.dims = getStyleDimension(frame, style, theme);
          }

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              styleConfig: style,
              size: style.dims?.size,
              layerName: options.name,
              layer: vectorLayer,
            });
          }
        }
        source.updateEdge(dataFrames);
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Node Styles',
            editor: StyleEditor,
            settings: {
              displayRotation: true,
            },
            defaultValue: defaultOptions.style,
          })
          .addCustomEditor({
            id: 'config.edgeStyle',
            path: 'config.edgeStyle',
            name: 'Edge Styles',
            editor: StyleEditor,
            settings: {
              edgeEditor: true,
            },
            defaultValue: defaultOptions.style,
          })
          .addRadio({
            path: 'config.arrow',
            name: 'Arrow',
            settings: {
              options: [
                { label: 'None', value: 0 },
                { label: 'Forward', value: 1 },
                { label: 'Reverse', value: -1 },
                { label: 'Both', value: 2 },
              ],
            },
            defaultValue: defaultOptions.arrow,
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
