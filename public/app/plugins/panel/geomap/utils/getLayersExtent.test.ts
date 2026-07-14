import Feature from 'ol/Feature';
import { createEmpty, extend, isEmpty } from 'ol/extent';
import { LineString, Point, type Geometry } from 'ol/geom';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import { type MapLayerState } from '../types';

import { getLayerGroupExtent, getLayersExtent } from './getLayersExtent';

type TestVectorLayer = VectorLayer<VectorSource<Feature<Geometry>>>;

function asVectorLayer(state: MapLayerState): TestVectorLayer {
  return state.layer as TestVectorLayer;
}

function vectorLayerState(name: string, coordinates: number[][]): MapLayerState {
  const source = new VectorSource();
  for (const coord of coordinates) {
    source.addFeature(new Feature(new Point(coord)));
  }
  return {
    options: { name, type: 'markers' } as MapLayerState['options'],
    layer: new VectorLayer({ source }),
    handler: {} as MapLayerState['handler'],
    onChange: jest.fn(),
    mouseEvents: {} as MapLayerState['mouseEvents'],
    getName: () => name,
  };
}

describe('getLayersExtent', () => {
  it('should return an empty extent when no vector or group layers are present', () => {
    expect(isEmpty(getLayersExtent([], false, false, 'x'))).toBe(true);
  });

  it('should merge extents from all vector layers when allLayers is true', () => {
    const layers = [vectorLayerState('a', [[0, 0]]), vectorLayerState('b', [[1000, 2000]])];
    const extent = getLayersExtent(layers, true, false, undefined);
    expect(isEmpty(extent)).toBe(false);
    const merged = createEmpty();
    extend(merged, asVectorLayer(layers[0]).getSource()!.getExtent());
    extend(merged, asVectorLayer(layers[1]).getSource()!.getExtent());
    expect(extent).toEqual(merged);
  });

  it('should return the source extent for the named layer when allLayers is false', () => {
    const layers = [
      vectorLayerState('markers', [
        [5, 5],
        [6, 7],
      ]),
    ];
    const extent = getLayersExtent(layers, false, false, 'markers');
    expect(extent).toEqual(asVectorLayer(layers[0]).getSource()!.getExtent());
  });

  it('should use only the last feature extent when lastOnly is true', () => {
    const layers = [
      vectorLayerState('route', [
        [0, 0],
        [10, 10],
        [20, 20],
      ]),
    ];
    const extent = getLayersExtent(layers, false, true, 'route');
    const feats = asVectorLayer(layers[0]).getSource()!.getFeatures();
    const lastGeom = feats[feats.length - 1].getGeometry()!;
    expect(extent).toEqual(lastGeom.getExtent());
  });
});

describe('getLayerGroupExtent', () => {
  it('should return last coordinate pair as a point extent for line geometries when lastOnly is true', () => {
    const line = new LineString([
      [0, 0],
      [1, 1],
      [9, 9],
    ]);
    const feature = new Feature(line);
    const source = new VectorSource({ features: [feature] });
    const inner = new VectorLayer({ source });
    const group = new LayerGroup({ layers: [inner] });

    const extents = getLayerGroupExtent(group, true);
    expect(extents[0]).toEqual([9, 9, 9, 9]);
  });
});
