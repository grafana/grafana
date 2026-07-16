import Feature, { type FeatureLike } from 'ol/Feature';
import type View from 'ol/View';
import { LineString, Point } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { get as getProjection } from 'ol/proj';
import Cluster from 'ol/source/Cluster';
import VectorSource from 'ol/source/Vector';

import { createTheme } from '@grafana/data';

import {
  defaultMarkerClusterConfig,
  formatMarkerClusterCount,
  getMarkerClusterDiameter,
  getMarkerClusterDistanceAtZoom,
  getMarkerClusterGeometry,
  getMarkerClusterHitFeatures,
  getMarkerClusterMembers,
  getMarkerClusterTextStyle,
  getMarkerClusterZoomExtent,
  getMarkerClusterZoomTarget,
  isMarkerClusterSourceLayer,
  type MarkerClusterColor,
  MARKER_CLUSTER_COUNT,
  MARKER_CLUSTER_TEXT,
  MARKER_CLUSTER_TEXT_COLOR,
  markerClusterBadgeStyle,
  MarkerClusterSource,
  syncMarkerClusterFeatureProperties,
} from './markerCluster';

const theme = createTheme();

const pointFeature = (rowIndex?: number, coords = [0, 0]) =>
  new Feature({
    geometry: new Point(coords),
    rowIndex,
    frame: {},
  });

const clusterFeature = (features: FeatureLike[]) => new Feature({ geometry: new Point([0, 0]), features });

function syncFeature(feature: FeatureLike, fixedColor?: MarkerClusterColor): void {
  syncMarkerClusterFeatureProperties(
    {
      forEachFeature: (callback: (feature: FeatureLike) => void) => callback(feature),
    } as never,
    fixedColor
  );
}

const fakeView = (overrides?: {
  resolution?: number;
  maxZoomResolution?: number;
  fitResolution?: number;
}): View =>
  ({
    getMaxZoom: () => 20,
    getResolutionForZoom: () => overrides?.maxZoomResolution ?? 0.001,
    getResolution: () => overrides?.resolution ?? 100,
    getResolutionForExtent: () => overrides?.fitResolution ?? 2,
  }) as unknown as View;

describe('marker cluster helpers', () => {
  it('uses only point geometries for cluster calculations', () => {
    const point = new Point([1, 2]);
    expect(getMarkerClusterGeometry(new Feature({ geometry: point }))).toBe(point);
    expect(
      getMarkerClusterGeometry(
        new Feature({
          geometry: new LineString([
            [0, 0],
            [1, 1],
          ]),
        })
      )
    ).toBeNull();
    expect(getMarkerClusterGeometry(new Feature({}))).toBeNull();
  });

  it('detects cluster members', () => {
    const first = pointFeature(1);
    const second = pointFeature(5);
    const members = [second, first];
    const cluster = clusterFeature(members);

    expect(getMarkerClusterMembers(cluster)).toEqual(members);
    expect(getMarkerClusterMembers(first)).toBeUndefined();
  });

  it('resolves tooltip hits to member markers', () => {
    const member = pointFeature(1);
    const plain = pointFeature(2);

    // Plain features and singleton clusters tooltip like ordinary markers
    expect(getMarkerClusterHitFeatures(plain)).toEqual([plain]);
    expect(getMarkerClusterHitFeatures(clusterFeature([member]))).toEqual([member]);
    // Multi-member clusters list every member (used when zooming can't separate them)
    expect(getMarkerClusterHitFeatures(clusterFeature([member, plain]))).toEqual([member, plain]);
  });

  it('splits groups smaller than minPoints into individual markers', () => {
    const raw = new VectorSource({
      features: [
        pointFeature(0, [0, 0]),
        pointFeature(1, [1, 1]),
        pointFeature(2, [2, 2]),
        pointFeature(3, [50, 50]),
        pointFeature(4, [51, 51]),
      ],
    });
    const source = new MarkerClusterSource({
      source: raw,
      distance: 10,
      geometryFunction: getMarkerClusterGeometry,
      minPoints: 3,
    });

    source.loadFeatures([-100, -100, 100, 100], 1, getProjection('EPSG:3857')!);

    const counts = source
      .getFeatures()
      .map((cluster) => getMarkerClusterMembers(cluster)?.length ?? 0)
      .sort();
    expect(counts).toEqual([1, 1, 3]);
  });

  it('keeps pairs clustered with the default minimum points', () => {
    const raw = new VectorSource({ features: [pointFeature(0, [0, 0]), pointFeature(1, [1, 1])] });
    const source = new MarkerClusterSource({
      source: raw,
      distance: 10,
      geometryFunction: getMarkerClusterGeometry,
    });

    source.loadFeatures([-100, -100, 100, 100], 1, getProjection('EPSG:3857')!);

    expect(source.getFeatures()).toHaveLength(1);
    expect(getMarkerClusterMembers(source.getFeatures()[0])).toHaveLength(2);
  });

  it('detects layers backed by a cluster source', () => {
    const raw = new VectorSource();
    expect(isMarkerClusterSourceLayer(new VectorLayer({ source: new Cluster({ source: raw }) }))).toBe(true);
    expect(isMarkerClusterSourceLayer(new VectorLayer({ source: raw }))).toBe(false);
    expect(isMarkerClusterSourceLayer(undefined)).toBe(false);
  });

  it('disables clustering above the max zoom level', () => {
    expect(getMarkerClusterDistanceAtZoom(13, 14, 40)).toBe(40);
    expect(getMarkerClusterDistanceAtZoom(14, 14, 40)).toBe(40);
    expect(getMarkerClusterDistanceAtZoom(14.1, 14, 40)).toBe(0);
    expect(getMarkerClusterDistanceAtZoom(15, 14, 40)).toBe(0);
    expect(getMarkerClusterDistanceAtZoom(undefined, 14, 40)).toBe(40);
  });

  it('sizes badges logarithmically and clamps very large clusters', () => {
    expect(getMarkerClusterDiameter(10)).toBeGreaterThan(getMarkerClusterDiameter(2));
    expect(getMarkerClusterDiameter(100)).toBeGreaterThan(getMarkerClusterDiameter(10));
    expect(getMarkerClusterDiameter(1_000_000)).toBe(getMarkerClusterDiameter(10_000_000));
  });

  it.each([
    [999, '999'],
    [1000, '1K'],
    [1500, '1.5K'],
    [999499, '999K'],
    [999999, '1M'],
    [1234567, '1.2M'],
  ])('formats %i as %s', (count, expected) => {
    expect(formatMarkerClusterCount(count)).toBe(expected);
  });

  it('defines a WebGL badge style with fill, stroke, and size expressions', () => {
    expect(markerClusterBadgeStyle['circle-radius']).toEqual(['/', ['get', 'size'], 2]);
    expect(markerClusterBadgeStyle['circle-fill-color']).toEqual([
      'color',
      ['get', 'red'],
      ['get', 'green'],
      ['get', 'blue'],
      ['get', 'opacity'],
    ]);
    expect(markerClusterBadgeStyle['circle-stroke-color']).toEqual(['color', 255, 255, 255, 0.92]);
  });

  it('copies singleton marker rendering properties from the member feature', () => {
    const member = pointFeature(7);
    member.setProperties({
      [MARKER_CLUSTER_TEXT]: 'Node A',
      [MARKER_CLUSTER_TEXT_COLOR]: '#ff0000',
      red: 10,
      green: 20,
      blue: 30,
      opacity: 0.4,
      size: 18,
      rotation: 1,
      offsetX: 2,
      offsetY: 3,
    });
    const cluster = clusterFeature([member]);

    syncFeature(cluster);

    expect(cluster.get(MARKER_CLUSTER_COUNT)).toBe(1);
    expect(cluster.get(MARKER_CLUSTER_TEXT)).toBe('Node A');
    expect(cluster.get('red')).toBe(10);
    expect(cluster.get('size')).toBe(18);
  });

  it('averages member colors and uses count-based size for multi-member clusters', () => {
    const first = pointFeature(0);
    const second = pointFeature(1);
    first.setProperties({ red: 10, green: 30, blue: 50, opacity: 0.5 });
    second.setProperties({ red: 30, green: 50, blue: 70, opacity: 0.9 });
    const cluster = clusterFeature([first, second]);

    syncFeature(cluster);

    expect(cluster.get(MARKER_CLUSTER_COUNT)).toBe(2);
    expect(cluster.get('red')).toBe(20);
    expect(cluster.get('green')).toBe(40);
    expect(cluster.get('blue')).toBe(60);
    expect(cluster.get('opacity')).toBe(0.7);
    expect(cluster.get('size')).toBe(getMarkerClusterDiameter(2));
  });

  it('uses a fixed cluster color instead of averaging when one is provided', () => {
    const first = pointFeature(0);
    const second = pointFeature(1);
    first.setProperties({ red: 10, green: 30, blue: 50, opacity: 0.5 });
    second.setProperties({ red: 30, green: 50, blue: 70, opacity: 0.9 });
    const cluster = clusterFeature([first, second]);

    syncFeature(cluster, { red: 200, green: 100, blue: 0, opacity: 1 });

    expect(cluster.get(MARKER_CLUSTER_COUNT)).toBe(2);
    expect(cluster.get('red')).toBe(200);
    expect(cluster.get('green')).toBe(100);
    expect(cluster.get('blue')).toBe(0);
    expect(cluster.get('opacity')).toBe(1);
  });

  it('keeps singleton clusters on their member color even with a fixed cluster color', () => {
    const member = pointFeature(7);
    member.setProperties({ red: 10, green: 20, blue: 30, opacity: 0.4 });
    const cluster = clusterFeature([member]);

    // Singletons render as the real marker, so they ignore the cluster color
    syncFeature(cluster, { red: 200, green: 100, blue: 0, opacity: 1 });

    expect(cluster.get('red')).toBe(10);
    expect(cluster.get('green')).toBe(20);
    expect(cluster.get('blue')).toBe(30);
  });

  it('renders count labels for clusters and configured text for singleton clusters', () => {
    const cluster = clusterFeature([pointFeature(0), pointFeature(1), pointFeature(2)]);
    cluster.setProperties({ [MARKER_CLUSTER_COUNT]: 3, opacity: 1 });
    expect(getMarkerClusterTextStyle(cluster, theme, { color: '#3274d9' })?.getText()?.getText()).toBe('3');

    const singleton = clusterFeature([pointFeature(0)]);
    singleton.setProperties({
      [MARKER_CLUSTER_COUNT]: 1,
      [MARKER_CLUSTER_TEXT]: 'Node A',
      [MARKER_CLUSTER_TEXT_COLOR]: '#ff0000',
      opacity: 1,
    });
    expect(getMarkerClusterTextStyle(singleton, theme, { color: '#3274d9' })?.getText()?.getText()).toBe('Node A');
  });

  it('renders labels even when marker opacity is zero, matching the non-clustered path', () => {
    const cluster = clusterFeature([pointFeature(0), pointFeature(1)]);
    cluster.setProperties({ [MARKER_CLUSTER_COUNT]: 2, opacity: 0 });
    expect(getMarkerClusterTextStyle(cluster, theme, { color: '#3274d9' })?.getText()?.getText()).toBe('2');

    const singleton = clusterFeature([pointFeature(0)]);
    singleton.setProperties({
      [MARKER_CLUSTER_COUNT]: 1,
      [MARKER_CLUSTER_TEXT]: 'labels only',
      opacity: 0,
    });
    expect(getMarkerClusterTextStyle(singleton, theme, { color: '#3274d9' })?.getText()?.getText()).toBe('labels only');
  });

  it('returns the extent covering member points for click-to-zoom', () => {
    const members = [pointFeature(0, [0, 0]), pointFeature(1, [1000, 2000]), pointFeature(2, [-500, 100])];
    expect(getMarkerClusterZoomExtent(members, 0)).toEqual([-500, 0, 1000, 2000]);
  });

  it('does not zoom clusters that are too small or co-located', () => {
    expect(getMarkerClusterZoomExtent([pointFeature(0)], 0)).toBeNull();
    expect(getMarkerClusterZoomExtent([pointFeature(0, [10, 10]), pointFeature(1, [10, 10])], 0)).toBeNull();
    expect(getMarkerClusterZoomExtent([pointFeature(0, [0, 0]), pointFeature(1, [5, 5])], 10)).toBeNull();
  });

  it('returns a fit extent when zooming can separate cluster members', () => {
    const members = [pointFeature(0, [0, 0]), pointFeature(1, [1000, 1000])];
    expect(getMarkerClusterZoomTarget(members, fakeView(), [800, 600], 50, 2)).toEqual([0, 0, 1000, 1000]);
  });

  it('returns null when zooming cannot separate the members', () => {
    const members = [pointFeature(0, [0, 0]), pointFeature(1, [1000, 1000])];
    // Members stay within one pixel of each other even at maximum zoom
    expect(getMarkerClusterZoomTarget(members, fakeView({ maxZoomResolution: 1000 }), [800, 600], 50, 2)).toBeNull();
    // View is already fitted to the members
    expect(
      getMarkerClusterZoomTarget(members, fakeView({ resolution: 2, fitResolution: 2 }), [800, 600], 50, 2)
    ).toBeNull();
  });

  it('is disabled by default', () => {
    expect(defaultMarkerClusterConfig.enabled).toBe(false);
  });

  it('has no fixed cluster color by default', () => {
    expect(defaultMarkerClusterConfig.color).toBe('');
  });
});
