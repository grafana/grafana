import Feature, { type FeatureLike } from 'ol/Feature';
import type View from 'ol/View';
import { createEmpty, extendCoordinate, getHeight, getWidth, isEmpty, type Extent } from 'ol/extent';
import { Point } from 'ol/geom';
import type BaseLayer from 'ol/layer/Base';
import Layer from 'ol/layer/Layer';
import type { Size } from 'ol/size';
import Cluster, { type Options as ClusterOptions } from 'ol/source/Cluster';
import { Fill, Stroke, Style, Text } from 'ol/style';
import type { FlatStyle } from 'ol/style/flat';

import { type GrafanaTheme2 } from '@grafana/data';

import { textMarker } from '../../style/markers';
import { defaultStyleConfig, type StyleConfigValues } from '../../style/types';

export interface MarkerClusterConfig {
  enabled?: boolean;
  /** Radius in pixels within which points are grouped */
  radius?: number;
  /** Clustering is disabled above this zoom level */
  maxZoom?: number;
  /** Minimum number of points required to form a cluster */
  minPoints?: number;
  /** Fixed cluster badge color; when empty, badges use the average of their members' colors */
  color?: string;
}

export const defaultMarkerClusterConfig: Required<MarkerClusterConfig> = {
  enabled: false,
  radius: 40,
  maxZoom: 24,
  minPoints: 2,
  color: '',
};

/** RGB channels (0-255) plus a 0-1 opacity used to fill a cluster badge */
export interface MarkerClusterColor {
  red: number;
  green: number;
  blue: number;
  opacity: number;
}

const MARKER_CLUSTER_FEATURES = 'features';
// These property names feed WebGL style expressions, where OpenLayers derives
// GLSL identifiers from them (a_prop_<name>). GLSL reserves identifiers
// containing two consecutive underscores, so the names must not start with an
// underscore or contain '__' anywhere or shader compilation fails.
export const MARKER_CLUSTER_COUNT = 'markerClusterCount';
export const MARKER_CLUSTER_TEXT = 'markerClusterText';
export const MARKER_CLUSTER_TEXT_COLOR = 'markerClusterTextColor';

const MARKER_CLUSTER_MAX_DIAMETER = 64;
const MARKER_CLUSTER_MIN_DIAMETER = 28;

const countExpression = ['get', MARKER_CLUSTER_COUNT];
const sizeExpression = ['get', 'size'];
const colorExpression = ['color', ['get', 'red'], ['get', 'green'], ['get', 'blue'], ['get', 'opacity']];

export const markerClusterBadgeStyle: FlatStyle = {
  'circle-radius': ['/', sizeExpression, 2],
  'circle-fill-color': colorExpression,
  'circle-stroke-color': ['color', 255, 255, 255, 0.92],
  'circle-stroke-width': ['case', ['>', countExpression, 99], 3, 2],
  'circle-opacity': ['get', 'opacity'],
  'circle-displacement': ['array', 0, 0],
};

export const markerClusterBadgeFilter = ['>', countExpression, 1];
export const markerClusterSingletonFilter = ['==', countExpression, 1];

export function getMarkerClusterGeometry(feature: FeatureLike): Point | null {
  const geometry = feature.getGeometry();
  return geometry instanceof Point ? geometry : null;
}

// Cluster features must be detected by the layer they came from, not by feature
// property shape: layers like geojson copy arbitrary user property bags onto
// their features, so a data property named 'features' would otherwise be
// misdetected as cluster members.
export function isMarkerClusterSourceLayer(layer: BaseLayer | null | undefined): boolean {
  return layer instanceof Layer && layer.getSource() instanceof Cluster;
}

function getMarkerClusterFeatures(feature: FeatureLike): FeatureLike[] {
  const features = feature.get(MARKER_CLUSTER_FEATURES);
  return Array.isArray(features) ? features : [feature];
}

export function getMarkerClusterMembers(feature: FeatureLike): FeatureLike[] | undefined {
  const features = feature.get(MARKER_CLUSTER_FEATURES);
  return Array.isArray(features) && features.length ? features : undefined;
}

/**
 * Features to report for a tooltip hit. Singleton cluster features render as
 * ordinary markers, so they resolve to their member (which carries the
 * frame/rowIndex the tooltip needs). Multi-member clusters resolve to their full
 * member list so the tooltip can enumerate them. Callers that would rather zoom
 * a separable cluster than list it must check getMarkerClusterZoomTarget first
 * and skip the tooltip when it returns an extent.
 */
export function getMarkerClusterHitFeatures(feature: FeatureLike): FeatureLike[] {
  const members = getMarkerClusterMembers(feature);
  if (!members) {
    return [feature];
  }
  return members.length === 1 ? [members[0]] : members;
}

export function getMarkerClusterZoomExtent(features: FeatureLike[], tolerance: number): Extent | null {
  if (features.length < 2) {
    return null;
  }

  const extent = createEmpty();
  for (const feature of features) {
    const geometry = feature.getGeometry();
    if (geometry instanceof Point) {
      extendCoordinate(extent, geometry.getCoordinates());
    }
  }

  if (isEmpty(extent) || (getWidth(extent) <= tolerance && getHeight(extent) <= tolerance)) {
    return null;
  }

  return extent;
}

/**
 * The extent a click should zoom to so a cluster's members separate, or null
 * when zooming cannot help: either the members stay within a pixel of one
 * another even at the view's maximum zoom (co-located points), or the view is
 * already fitted to them. A null result is the signal to list the members in a
 * tooltip instead of zooming.
 */
export function getMarkerClusterZoomTarget(
  members: FeatureLike[],
  view: View,
  mapSize: Size | undefined,
  paddingPx: number,
  hitTolerancePx: number
): Extent | null {
  // Separability must be judged at maximum zoom, not the current one: zoomed
  // out, every cluster's members sit within a few screen pixels of each other
  // even when they are far apart on the ground.
  const maxZoomResolution = view.getResolutionForZoom(view.getMaxZoom());
  const extent = getMarkerClusterZoomExtent(members, maxZoomResolution * hitTolerancePx);
  if (!extent) {
    return null;
  }

  const currentResolution = view.getResolution();
  if (mapSize && currentResolution) {
    const paddedSize: Size = [Math.max(1, mapSize[0] - 2 * paddingPx), Math.max(1, mapSize[1] - 2 * paddingPx)];
    const fitResolution = Math.max(view.getResolutionForExtent(extent, paddedSize), maxZoomResolution);
    if (currentResolution <= fitResolution) {
      return null;
    }
  }

  return extent;
}

export function getMarkerClusterDiameter(count: number): number {
  if (count <= 1) {
    return MARKER_CLUSTER_MIN_DIAMETER;
  }

  return Math.min(MARKER_CLUSTER_MAX_DIAMETER, MARKER_CLUSTER_MIN_DIAMETER + Math.log2(count) * 5);
}

/**
 * Points cluster up to and including maxZoom and render individually above it
 * (matching clusterMaxZoom semantics in other map libraries): with distance 0
 * the cluster source only groups features at identical coordinates. The small
 * epsilon absorbs fractional zoom levels from animated zooming.
 */
export function getMarkerClusterDistanceAtZoom(zoom: number | undefined, maxZoom: number, radius: number): number {
  return zoom !== undefined && zoom > maxZoom + 1e-3 ? 0 : radius;
}

/**
 * ol/source/Cluster does not support a minimum cluster size, so groups smaller
 * than minPoints are split back into individual singleton features after each
 * re-cluster. cluster() runs inside refresh() before the features are added to
 * the source, so the split fires no extra source events.
 */
export class MarkerClusterSource extends Cluster {
  private readonly minPoints: number;

  constructor(options: ClusterOptions & { minPoints?: number }) {
    const { minPoints, ...clusterOptions } = options;
    super(clusterOptions);
    this.minPoints = Math.max(defaultMarkerClusterConfig.minPoints, minPoints ?? defaultMarkerClusterConfig.minPoints);
  }

  protected override cluster(): void {
    super.cluster();
    if (this.minPoints <= 2) {
      return;
    }

    this.features = this.features.flatMap((clusterFeature) => {
      const members = getMarkerClusterMembers(clusterFeature) ?? [];
      if (members.length <= 1 || members.length >= this.minPoints) {
        return clusterFeature;
      }
      return members.map((member) => {
        const geometry = member.getGeometry();
        return new Feature({
          geometry: geometry instanceof Point ? new Point(geometry.getCoordinates()) : undefined,
          [MARKER_CLUSTER_FEATURES]: [member],
        });
      });
    });
  }
}

export function formatMarkerClusterCount(count: number): string {
  // Promote units at the rounding boundary: 999500+ would render as '1000K'
  if (count >= 999500) {
    return `${trimCompactCount(count / 1000000)}M`;
  }

  if (count >= 1000) {
    return `${trimCompactCount(count / 1000)}K`;
  }

  return `${count}`;
}

export function syncMarkerClusterFeatureProperties(
  clusterSource: Cluster<FeatureLike>,
  fixedColor?: MarkerClusterColor
): void {
  clusterSource.forEachFeature((clusterFeature) => {
    const features = getMarkerClusterFeatures(clusterFeature);
    const count = features.length;

    if (count === 1) {
      const feature = features[0];
      clusterFeature.setProperties(
        {
          [MARKER_CLUSTER_COUNT]: 1,
          [MARKER_CLUSTER_TEXT]: feature?.get(MARKER_CLUSTER_TEXT),
          [MARKER_CLUSTER_TEXT_COLOR]: feature?.get(MARKER_CLUSTER_TEXT_COLOR),
          red: feature?.get('red') ?? 255,
          green: feature?.get('green') ?? 255,
          blue: feature?.get('blue') ?? 255,
          opacity: feature?.get('opacity') ?? 1,
          size: feature?.get('size') ?? MARKER_CLUSTER_MIN_DIAMETER,
          rotation: feature?.get('rotation') ?? 0,
          offsetX: feature?.get('offsetX') ?? 0,
          offsetY: feature?.get('offsetY') ?? 0,
        },
        true
      );
      return;
    }

    // A configured cluster color wins over averaging the members' colors
    const color = fixedColor ?? getAverageFeatureColor(features);
    clusterFeature.setProperties(
      {
        [MARKER_CLUSTER_COUNT]: count,
        red: color.red,
        green: color.green,
        blue: color.blue,
        opacity: color.opacity,
        size: getMarkerClusterDiameter(count),
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      },
      true
    );
  });
}

export function getMarkerClusterTextStyle(
  feature: FeatureLike,
  theme: GrafanaTheme2,
  baseValues: StyleConfigValues
): Style | undefined {
  // No opacity guard here: the non-clustered path renders text labels
  // regardless of marker opacity, so "labels only" configs (text + opacity 0)
  // must keep working when clustering is enabled.
  const count = Number(feature.get(MARKER_CLUSTER_COUNT) ?? 1);
  if (count > 1) {
    return new Style({
      text: new Text({
        text: formatMarkerClusterCount(count),
        font: `600 ${count > 999 ? 11 : 12}px ${theme.typography.fontFamily}`,
        fill: new Fill({ color: '#FFFFFF' }),
        stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.38)', width: 3 }),
      }),
    });
  }

  const text = feature.get(MARKER_CLUSTER_TEXT);
  if (!text) {
    return undefined;
  }

  return textMarker({
    ...baseValues,
    color: feature.get(MARKER_CLUSTER_TEXT_COLOR) ?? baseValues.color,
    text,
    textConfig: baseValues.textConfig ?? defaultStyleConfig.textConfig,
  });
}

function getAverageFeatureColor(features: FeatureLike[]): MarkerClusterColor {
  let red = 0;
  let green = 0;
  let blue = 0;
  let opacity = 0;
  let count = 0;

  for (const feature of features) {
    const featureRed = Number(feature.get('red'));
    const featureGreen = Number(feature.get('green'));
    const featureBlue = Number(feature.get('blue'));
    const featureOpacity = Number(feature.get('opacity'));

    if (
      Number.isFinite(featureRed) &&
      Number.isFinite(featureGreen) &&
      Number.isFinite(featureBlue) &&
      Number.isFinite(featureOpacity)
    ) {
      red += featureRed;
      green += featureGreen;
      blue += featureBlue;
      opacity += featureOpacity;
      count++;
    }
  }

  if (!count) {
    return { red: 255, green: 255, blue: 255, opacity: 1 };
  }

  return {
    red: Math.round(red / count),
    green: Math.round(green / count),
    blue: Math.round(blue / count),
    opacity: opacity / count,
  };
}

function trimCompactCount(value: number): string {
  if (value >= 100) {
    return `${Math.round(value)}`;
  }

  return `${Math.round(value * 10) / 10}`.replace(/\.0$/, '');
}
