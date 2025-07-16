import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import TileSource from 'ol/source/Tile';
import VectorSource from 'ol/source/Vector';

import { getTemplateSrv } from '@grafana/runtime';

// Mock the config module to avoid undefined panels error
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

// Mock the dimensions module since it's imported by utils.ts
jest.mock('app/features/dimensions/color', () => ({
  getColorDimension: jest.fn(),
}));
jest.mock('app/features/dimensions/scalar', () => ({
  getScalarDimension: jest.fn(),
}));
jest.mock('app/features/dimensions/scale', () => ({
  getScaledDimension: jest.fn(),
}));
jest.mock('app/features/dimensions/text', () => ({
  getTextDimension: jest.fn(),
}));

// Mock the grafana datasource since it's imported by utils.ts
jest.mock('app/plugins/datasource/grafana/datasource', () => ({
  getGrafanaDatasource: jest.fn(),
}));

import { hasVariableDependencies, hasLayerData } from './utils';

// Test fixtures
const createTestFeature = () => new Feature(new Point([0, 0]));

const createTestVectorSource = (hasFeature = false): VectorSource<Feature<Point>> => {
  const source = new VectorSource<Feature<Point>>();
  if (hasFeature) {
    source.addFeature(createTestFeature());
  }
  return source;
};

const createTestWebGLStyle = () => ({
  'circle-radius': 8,
  'circle-fill-color': '#000000',
  'circle-opacity': 1,
});

describe('hasVariableDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when object contains existing template variables', () => {
    const availableVariables = [{ name: 'variable' }];
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockImplementation((str) => {
        return availableVariables.some((v) => str.includes(`$${v.name}`));
      }),
      getVariables: jest.fn().mockReturnValue(availableVariables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = { key: '$variable' };
    expect(hasVariableDependencies(obj)).toBe(true);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });

  it('should return false when object contains non-existent template variables', () => {
    const availableVariables = [{ name: 'variable' }];
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockImplementation((str) => {
        return availableVariables.some((v) => str.includes(`$${v.name}`));
      }),
      getVariables: jest.fn().mockReturnValue(availableVariables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = { key: '$nonexistent' };
    expect(hasVariableDependencies(obj)).toBe(false);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });

  it('should return false when object does not contain template variables', () => {
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockReturnValue(false),
      getVariables: jest.fn().mockReturnValue([]),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = { key: 'static value' };
    expect(hasVariableDependencies(obj)).toBe(false);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });

  it('should handle nested objects with existing template variables', () => {
    const availableVariables = [{ name: 'variable' }];
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockImplementation((str) => {
        return availableVariables.some((v) => str.includes(`$${v.name}`));
      }),
      getVariables: jest.fn().mockReturnValue(availableVariables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = {
      key: 'static value',
      nested: {
        anotherKey: '$variable',
      },
    };
    expect(hasVariableDependencies(obj)).toBe(true);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });
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
