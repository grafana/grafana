import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import TileSource from 'ol/source/Tile';
import VectorSource from 'ol/source/Vector';

// Mock the config module to avoid undefined panels error
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

// Mock the dimensions module since it's imported by utils.ts
jest.mock('app/features/dimensions', () => ({
  getColorDimension: jest.fn(),
  getScalarDimension: jest.fn(),
  getScaledDimension: jest.fn(),
  getTextDimension: jest.fn(),
}));

// Mock the grafana datasource since it's imported by utils.ts
jest.mock('app/plugins/datasource/grafana/datasource', () => ({
  getGrafanaDatasource: jest.fn(),
}));

import { hasLayerData } from './utils';

// Test fixtures
const createTestFeature = () => new Feature(new Point([0, 0]));

const createTestVectorSource = (hasFeature = false): VectorSource<Point> => {
  const source = new VectorSource<Point>();
  if (hasFeature) {
    source.addFeature(createTestFeature());
  }
  return source;
};

const createTestWebGLStyle = () => ({
  symbol: {
    symbolType: 'circle',
    size: 8,
    color: '#000000',
    opacity: 1,
  },
});

describe('hasLayerData', () => {
  it('should return false for empty vector layer', () => {
    const layer = new VectorLayer({
      source: createTestVectorSource(),
    });
    expect(hasLayerData(layer)).toBe(false);
  });

  it('should return true for vector layer with features', () => {
    const layer = new VectorLayer({
      source: createTestVectorSource(true),
    });
    expect(hasLayerData(layer)).toBe(true);
  });

  it('should return true for layer group with data', () => {
    const vectorLayer = new VectorLayer({
      source: createTestVectorSource(true),
    });
    const group = new LayerGroup({
      layers: [vectorLayer],
    });
    expect(hasLayerData(group)).toBe(true);
  });

  it('should return false for empty layer group', () => {
    const group = new LayerGroup({
      layers: [],
    });
    expect(hasLayerData(group)).toBe(false);
  });

  it('should return true for tile layer with source', () => {
    const layer = new TileLayer({
      source: new TileSource({}),
    });
    expect(hasLayerData(layer)).toBe(true);
  });

  it('should return false for tile layer without source', () => {
    const layer = new TileLayer({});
    expect(hasLayerData(layer)).toBe(false);
  });

  it('should return true for WebGLPointsLayer with features', () => {
    const layer = new WebGLPointsLayer({
      source: createTestVectorSource(true),
      style: createTestWebGLStyle(),
    });
    expect(hasLayerData(layer)).toBe(true);
  });

  it('should return false for empty WebGLPointsLayer', () => {
    const layer = new WebGLPointsLayer({
      source: createTestVectorSource(),
      style: createTestWebGLStyle(),
    });
    expect(hasLayerData(layer)).toBe(false);
  });

  it('should return true for layer group with WebGLPointsLayer containing data', () => {
    const webglLayer = new WebGLPointsLayer({
      source: createTestVectorSource(true),
      style: createTestWebGLStyle(),
    });
    const group = new LayerGroup({
      layers: [webglLayer],
    });
    expect(hasLayerData(group)).toBe(true);
  });
});
