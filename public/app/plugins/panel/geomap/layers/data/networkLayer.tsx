import { isNumber } from 'lodash';
import Feature, { FeatureLike } from 'ol/Feature';
import OpenLayersMap from 'ol/Map';
import { Geometry, LineString, Point, SimpleGeometry } from 'ol/geom';
import VectorImage from 'ol/layer/VectorImage';
import { Fill, Stroke, Style, Text } from 'ol/style';
import FlowLine from 'ol-ext/style/FlowLine';
import { ReactNode } from 'react';
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
  Field,
  PluginState,
} from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { GraphFrame } from 'app/plugins/panel/nodeGraph/types';
import { getGraphFrame } from 'app/plugins/panel/nodeGraph/utils';

import { MarkersLegendProps, MarkersLegend } from '../../components/MarkersLegend';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { StyleEditor } from '../../editor/StyleEditor';
import { StyleConfig, defaultStyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';

export interface NetworkConfig {
  style: StyleConfig;
  showLegend?: boolean;
  edgeStyle: StyleConfig;
  arrow?: 0 | 1 | -1 | 2;
}

const defaultOptions: NetworkConfig = {
  style: defaultStyleConfig,
  showLegend: false,
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
};

/**
 * Map layer configuration for network overlay
 */
export const networkLayer: MapLayerRegistryItem<NetworkConfig> = {
  id: NETWORK_LAYER_ID,
  name: 'Network',
  description: 'Render a node graph as a map layer',
  isBaseMap: false,
  showLocation: true,
  hideOpacity: true,
  state: PluginState.beta,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions<NetworkConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const edgeStyle = await getStyleConfigState(config.edgeStyle);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource(location);
    const vectorLayer = new VectorImage({
      source
    });
    const hasArrows = config.arrow === 1 || config.arrow === -1 || config.arrow === 2;

    // TODO update legend to display edges as well
    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    vectorLayer.setStyle((feature: FeatureLike) => {
      const geom = feature.getGeometry();
      const idx = feature.get('rowIndex');
      const dims = style.dims;

      if (!style.fields && !edgeStyle.fields && !hasArrows && geom?.getType() !== 'LineString') {
        // Set a global style
        return style.maker(style.base);
      }

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
          if (edgeDims.text || edgeStyle.config.text?.mode === TextDimensionMode.Fixed) {
            const labelStyle = new Style({
              zIndex: 10,
              text: new Text({
                text: edgeDims.text?.get(edgeId) ?? edgeStyle.config.text?.fixed,
                font: `normal ${edgeTextConfig?.fontSize}px ${fontFamily}`,
                fill: new Fill({ color: color1 ?? defaultStyleConfig.color.fixed }),
                stroke: new Stroke({
                  color: tinycolor(theme.visualization.getColorByName('text')).setAlpha(opacity).toString(),
                  width: Math.max(edgeTextConfig?.fontSize! / 10, 1),
                }),
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

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
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
        const graphFrames = getGraphFrame(data.series);

        for (const frame of data.series) {
          if (frame === graphFrames.edges[0]) {
            edgeStyle.dims = getStyleDimension(frame, edgeStyle, theme);
          } else {
            style.dims = getStyleDimension(frame, style, theme);
          }

          updateEdge(source, graphFrames);
        }
      },

      // Marker overlay options
      registerOptionsUI: (builder, context) => {
        const networkFrames = getGraphFrame(context.data);
        const frameNodes = networkFrames.nodes[0];
        const frameEdges = networkFrames.edges[0];

        builder
          .addCustomEditor({
            id: 'config.style',
            category: ['Node Styles'],
            path: 'config.style',
            name: 'Node Styles',
            editor: StyleEditor,
            settings: {
              displayRotation: true,
              frameMatcher: (frame: DataFrame) => frame === frameNodes,
            },
            defaultValue: defaultOptions.style,
          })
          .addCustomEditor({
            id: 'config.edgeStyle',
            category: ['Edge Styles'],
            path: 'config.edgeStyle',
            name: 'Edge Styles',
            editor: StyleEditor,
            settings: {
              hideSymbol: true,
              frameMatcher: (frame: DataFrame) => frame === frameEdges,
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

function updateEdge(source: FrameVectorSource, graphFrames: GraphFrame) {
  source.clear(true);

  const frameNodes = graphFrames.nodes[0];
  const frameEdges = graphFrames.edges[0];

  if (!frameNodes || !frameEdges) {
    // TODO: provide helpful error message / link to docs for how to format data
    return;
  }

  const info = getGeometryField(frameNodes, source.location);
  if (!info.field) {
    source.changed();
    return;
  }

  // TODO: Fix this
  // eslint-disable-next-line
  const field = info.field as unknown as Field<Point>;

  // TODO for nodes, don't hard code id field name
  const nodeIdIndex = frameNodes.fields.findIndex((f: Field) => f.name === 'id');
  const nodeIdValues = frameNodes.fields[nodeIdIndex].values;

  // Edges
  // TODO for edges, don't hard code source and target fields
  const sourceIndex = frameEdges.fields.findIndex((f: Field) => f.name === 'source');
  const targetIndex = frameEdges.fields.findIndex((f: Field) => f.name === 'target');

  const sources = frameEdges.fields[sourceIndex].values;
  const targets = frameEdges.fields[targetIndex].values;

  // Loop through edges, referencing node locations
  for (let i = 0; i < sources.length; i++) {
    // Create linestring for each edge
    const sourceId = sources[i];
    const targetId = targets[i];

    const sourceNodeIndex = nodeIdValues.findIndex((value: string) => value === sourceId);
    const targetNodeIndex = nodeIdValues.findIndex((value: string) => value === targetId);

    if (!field.values[sourceNodeIndex] || !field.values[targetNodeIndex]) {
      continue;
    }

    const geometryEdge: Geometry = new LineString([
      field.values[sourceNodeIndex].getCoordinates(),
      field.values[targetNodeIndex].getCoordinates(),
    ]);

    const edgeFeature = new Feature({
      geometry: geometryEdge,
    });
    edgeFeature.setId(i);
    source['addFeatureInternal'](edgeFeature); // @TODO revisit?
  }

  // Nodes
  for (let i = 0; i < frameNodes.length; i++) {
    source['addFeatureInternal'](
      new Feature({
        frameNodes,
        rowIndex: i,
        geometry: info.field.values[i],
      })
    );
  }

  // only call source at the end
  source.changed();
}
