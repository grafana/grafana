import type Feature from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import { type Point } from 'ol/geom';
import { VectorImage } from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import { type ReactNode } from 'react';
import { ReplaySubject } from 'rxjs';
import tinycolor from 'tinycolor2';

import {
  type MapLayerRegistryItem,
  type MapLayerOptions,
  type PanelData,
  type GrafanaTheme2,
  FrameGeometrySourceMode,
  type EventBus,
  type PanelOptionsEditorBuilder,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getLocationMatchers } from 'app/features/geo/utils/location';

import { MarkersLegend, type MarkersLegendProps } from '../../components/MarkersLegend';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { StyleEditor } from '../../editor/StyleEditor';
import { getWebGLStyle, textMarker } from '../../style/markers';
import { DEFAULT_SIZE, defaultStyleConfig, type StyleConfig, type StyleConfigValues } from '../../style/types';
import { getDisplacement, getRGBValues, getStyleConfigState, styleUsesText } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';

import {
  defaultMarkerClusterConfig,
  getMarkerClusterDistanceAtZoom,
  getMarkerClusterGeometry,
  getMarkerClusterTextStyle,
  MARKER_CLUSTER_TEXT,
  MARKER_CLUSTER_TEXT_COLOR,
  markerClusterBadgeFilter,
  markerClusterBadgeStyle,
  MarkerClusterSource,
  markerClusterSingletonFilter,
  type MarkerClusterColor,
  type MarkerClusterConfig,
  syncMarkerClusterFeatureProperties,
} from './markerCluster';

// Configuration options for Circle overlays
export interface MarkersConfig {
  style: StyleConfig;
  showLegend?: boolean;
  cluster?: MarkerClusterConfig;
}

const defaultOptions: MarkersConfig = {
  style: defaultStyleConfig,
  showLegend: true,
  cluster: defaultMarkerClusterConfig,
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

export function setPointFeatureProperties(feature: Feature<Point>, values: StyleConfigValues, theme: GrafanaTheme2): void {
  const colorString = tinycolor(theme.visualization.getColorByName(values.color)).toString();
  const colorValues = getRGBValues(colorString);
  const radius = values.size ?? DEFAULT_SIZE;
  const displacement = getDisplacement(values.symbolAlign ?? defaultStyleConfig.symbolAlign, radius);

  feature.setProperties(
    {
      red: colorValues?.r ?? 255,
      green: colorValues?.g ?? 255,
      blue: colorValues?.b ?? 255,
      size: (values.size ?? 1) * 2, // TODO unify sizing across all source types
      rotation: ((values.rotation ?? 0) * Math.PI) / 180,
      opacity: (values.opacity ?? 1) * (colorValues?.a ?? 1),
      offsetX: displacement[0],
      offsetY: displacement[1],
      [MARKER_CLUSTER_TEXT]: values.text,
      [MARKER_CLUSTER_TEXT_COLOR]: colorString,
    },
    true
  );
}

export function hidePointFeature(feature: Feature<Point>): void {
  feature.setProperties(
    {
      red: 0,
      green: 0,
      blue: 0,
      size: 0,
      rotation: 0,
      opacity: 0,
      offsetX: 0,
      offsetY: 0,
      [MARKER_CLUSTER_TEXT]: undefined,
      [MARKER_CLUSTER_TEXT_COLOR]: undefined,
    },
    true
  );
}

export function getClusterFixedColor(color: string | undefined, theme: GrafanaTheme2): MarkerClusterColor | undefined {
  if (!color) {
    return undefined;
  }
  const rgb = getRGBValues(tinycolor(theme.visualization.getColorByName(color)).toString());
  return rgb ? { red: rgb.r, green: rgb.g, blue: rgb.b, opacity: rgb.a ?? 1 } : undefined;
}

/**
 * Map layer configuration for circle overlay
 */
export const markersLayer: MapLayerRegistryItem<MarkersConfig> = {
  id: MARKERS_LAYER_ID,
  name: 'Markers',
  description: 'Use markers to render each data point',
  isBaseMap: false,
  showLocation: true,
  hideOpacity: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions<MarkersConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };
    const cluster = { ...defaultMarkerClusterConfig, ...config.cluster };

    const style = await getStyleConfigState(config.style);
    const symbol = config.style.symbol?.fixed;
    const webGLStyle = await getWebGLStyle(symbol, config.style.opacity);
    const hasText = styleUsesText(config.style);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource<Point>(location);
    const getStyleValues = (idx: number): StyleConfigValues => {
      const dims = style.dims;
      const values = { ...style.base };

      if (dims?.color) {
        values.color = dims.color.get(idx);
      }
      if (dims?.size) {
        values.size = dims.size.get(idx);
      }
      if (dims?.text) {
        values.text = dims.text.get(idx);
      }
      if (dims?.rotation) {
        values.rotation = dims.rotation.get(idx);
      }
      return values;
    };

    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    // Marker overlay options
    const registerOptionsUI = (builder: PanelOptionsEditorBuilder<MapLayerOptions<MarkersConfig>>) => {
      builder
        .addCustomEditor({
          id: 'config.style',
          path: 'config.style',
          name: t('geomap.markers-layer.name-styles', 'Styles'),
          editor: StyleEditor,
          settings: {
            displayRotation: true,
          },
          defaultValue: defaultOptions.style,
        })
        .addBooleanSwitch({
          path: 'config.showLegend',
          name: t('geomap.markers-layer.name-show-legend', 'Show legend'),
          description: t('geomap.markers-layer.description-show-legend', 'Show map legend'),
          defaultValue: defaultOptions.showLegend,
        })
        .addBooleanSwitch({
          path: 'config.cluster.enabled',
          name: t('geomap.markers-layer.name-cluster-enabled', 'Cluster points'),
          description: t('geomap.markers-layer.description-cluster-enabled', 'Group nearby points into clusters'),
          defaultValue: defaultMarkerClusterConfig.enabled,
        })
        .addSliderInput({
          path: 'config.cluster.radius',
          name: t('geomap.markers-layer.name-cluster-radius', 'Cluster radius'),
          description: t(
            'geomap.markers-layer.description-cluster-radius',
            'Radius in pixels within which points are grouped'
          ),
          defaultValue: defaultMarkerClusterConfig.radius,
          settings: {
            min: 1,
            max: 200,
            step: 1,
          },
          showIf: (cfg) => Boolean(cfg.config?.cluster?.enabled),
        })
        .addSliderInput({
          path: 'config.cluster.maxZoom',
          name: t('geomap.markers-layer.name-cluster-max-zoom', 'Max zoom'),
          description: t(
            'geomap.markers-layer.description-cluster-max-zoom',
            'Clustering is disabled above this zoom level'
          ),
          defaultValue: defaultMarkerClusterConfig.maxZoom,
          settings: {
            min: 0,
            max: 24,
            step: 1,
          },
          showIf: (cfg) => Boolean(cfg.config?.cluster?.enabled),
        })
        .addSliderInput({
          path: 'config.cluster.minPoints',
          name: t('geomap.markers-layer.name-cluster-min-points', 'Minimum points'),
          description: t(
            'geomap.markers-layer.description-cluster-min-points',
            'Minimum number of points required to form a cluster'
          ),
          defaultValue: defaultMarkerClusterConfig.minPoints,
          settings: {
            min: 2,
            max: 32,
            step: 1,
          },
          showIf: (cfg) => Boolean(cfg.config?.cluster?.enabled),
        })
        .addColorPicker({
          path: 'config.cluster.color',
          name: t('geomap.markers-layer.name-cluster-color', 'Cluster color'),
          description: t(
            'geomap.markers-layer.description-cluster-color',
            'Fixed color for clusters. Leave empty to blend the colors of the grouped markers.'
          ),
          defaultValue: defaultMarkerClusterConfig.color,
          settings: { enableNamedColors: true, isClearable: true },
          showIf: (cfg) => Boolean(cfg.config?.cluster?.enabled),
        });
    };

    if (cluster.enabled) {
      const clusterFixedColor = getClusterFixedColor(cluster.color, theme);
      const clusterSource = new MarkerClusterSource({
        source,
        distance: cluster.radius,
        geometryFunction: getMarkerClusterGeometry,
        minPoints: cluster.minPoints,
      });
      clusterSource.on('change', () => syncMarkerClusterFeatureProperties(clusterSource, clusterFixedColor));

      // Stop clustering above the configured max zoom so individual points can
      // be inspected. The view's own max zoom acts as a ceiling to guarantee
      // points always separate at full zoom. setDistance only refreshes when
      // the value actually changes, so this is cheap to run on every move.
      const syncDistanceToZoom = () => {
        const view = map.getView();
        const unclusterZoom = Math.min(cluster.maxZoom, view.getMaxZoom() - 1);
        clusterSource.setDistance(getMarkerClusterDistanceAtZoom(view.getZoom(), unclusterZoom, cluster.radius));
      };
      map.on('moveend', syncDistanceToZoom);
      syncDistanceToZoom();

      const singletonLayer = new WebGLPointsLayer({
        source: clusterSource,
        style: webGLStyle,
        filter: markerClusterSingletonFilter,
      });
      const clusterBadgeLayer = new WebGLPointsLayer({
        source: clusterSource,
        style: markerClusterBadgeStyle,
        filter: markerClusterBadgeFilter,
      });
      const clusterTextLayer = new VectorImage({
        source: clusterSource,
        // The count text must never be dropped: its badge circle renders on a
        // separate WebGL layer that doesn't participate in decluttering, so a
        // decluttered label would leave a badge with no visible count.
        declutter: false,
        style: (feature) => getMarkerClusterTextStyle(feature, theme, style.base),
      });
      const lineLayer = new VectorImage({
        source,
        declutter: true,
        style: (feature) => {
          if (feature.getGeometry()?.getType() !== 'LineString') {
            return undefined;
          }
          return style.maker(getStyleValues(feature.get('rowIndex')));
        },
      });
      const layerList = [lineLayer, ...(symbol || !hasText ? [singletonLayer] : []), clusterBadgeLayer, clusterTextLayer];
      const legendLayer = symbol || !hasText ? singletonLayer : clusterTextLayer;
      const layers = new LayerGroup({ layers: layerList });

      return {
        init: () => layers,
        legend,
        dispose: () => {
          map.un('moveend', syncDistanceToZoom);
          clusterSource.setSource(null);
        },
        update: (data: PanelData) => {
          if (!data.series?.length) {
            source.clear();
            return; // ignore empty
          }

          // Only the first frame for now (matches the non-clustered path)
          const frame = data.series[0];
          style.dims = getStyleDimension(frame, style, theme);

          if (legend) {
            legendProps.next({
              styleConfig: style,
              size: style.dims?.size,
              layerName: options.name,
              layer: legendLayer,
            });
          }

          source.update(frame);
          source.forEachFeature((feature) => {
            if (feature.getGeometry()?.getType() !== 'Point') {
              return;
            }
            setPointFeatureProperties(feature, getStyleValues(feature.get('rowIndex')), theme);
          });
          // Notify the cluster source directly rather than the wrapped source:
          // a wrapped-source change event triggers a full re-cluster, which
          // source.update() already did, while this only needs to re-sync the
          // silently written feature properties and bump the layer revision.
          clusterSource.changed();
        },
        registerOptionsUI,
      };
    }

    const symbolLayer = new WebGLPointsLayer({ source, style: webGLStyle });
    const vectorLayer = new VectorImage({ source, declutter: true });
    // Initialize hasVector with just text check, will be updated when features are available
    let hasVector = hasText;

    const layers = new LayerGroup({
      layers: hasVector ? (symbol ? [symbolLayer, vectorLayer] : [vectorLayer]) : [symbolLayer],
    });

    return {
      init: () => layers,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }

        for (const frame of data.series) {
          style.dims = getStyleDimension(frame, style, theme);

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              styleConfig: style,
              size: style.dims?.size,
              layerName: options.name,
              layer: symbolLayer,
            });
          }

          source.update(frame);

          // Track if we find any line strings during feature processing
          let hasLineString = false;
          // Track coordinates to avoid rendering duplicate markers at the same location
          const processedMarkers = new Set<string>();

          // Helper function to create a robust uniqueness key
          const createMarkerKey = (coordinates: number[], markerValues: StyleConfigValues): string => {
            const coord = `${coordinates[0]},${coordinates[1]}`;
            const { color, size, text, rotation } = markerValues;
            return `markerAddressKey|${coord}|${color}|${size}|${text}|${rotation}`;
          };

          source.forEachFeature((feature) => {
            const geometry = feature.getGeometry();
            const isLineString = geometry?.getType() === 'LineString';

            if (isLineString) {
              hasLineString = true;
            }

            const idx: number = feature.get('rowIndex');
            const values = getStyleValues(idx);

            // For point geometries, check if we've already processed this marker
            if (geometry?.getType() === 'Point') {
              const coordinates = geometry.getCoordinates();

              // Skip this feature if coordinates are invalid
              if (!coordinates || coordinates.length < 2) {
                hidePointFeature(feature);
                return;
              }

              const markerKey = createMarkerKey(coordinates, values);

              // Skip this feature if we've already processed a marker with identical properties
              if (processedMarkers.has(markerKey)) {
                hidePointFeature(feature);
                return;
              }
              processedMarkers.add(markerKey);
            }

            // Set style to be used by LineString
            if (isLineString) {
              const lineStringStyle = style.maker(values);
              feature.setStyle(lineStringStyle);
            } else {
              setPointFeatureProperties(feature, values, theme);
            }

            // Set style to be used by VectorLayer (text only)
            if (hasText) {
              const textStyle = textMarker(values);
              feature.setStyle(textStyle);
            }
          });
          source.changed();

          // Update hasVector state after processing all features
          hasVector = hasText || hasLineString;

          // Update layer visibility based on current hasVector state
          const layersArray = layers.getLayers();
          layersArray.clear();
          if (hasVector) {
            layersArray.extend(symbol ? [symbolLayer, vectorLayer] : [vectorLayer]);
          } else {
            layersArray.extend([symbolLayer]);
          }

          break; // Only the first frame for now!
        }
      },

      registerOptionsUI,
    };
  },

  // fill in the default values
  defaultOptions,
};
