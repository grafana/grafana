import Feature from 'ol/Feature';
import { Point } from 'ol/geom';

import { GeometryTypeId } from '../style/types';

import { getLayerPropertyInfo, getUniqueFeatureValues } from './getFeatures';

describe('get features utils', () => {
  const features = [
    new Feature({ a: 1, b: 30, hello: 'world', geometry: new Point([0, 0]) }),
    new Feature({ a: 2, b: 20, hello: 'world', geometry: new Point([0, 0]) }),
    new Feature({ a: 2, b: 10, c: 30, geometry: new Point([0, 0]) }),
  ];

  it('reads the distinct field names', () => {
    const info = getLayerPropertyInfo(features);
    expect(info.geometryType).toBe(GeometryTypeId.Point);
    expect(info.propertes.map((v) => v.value)).toMatchInlineSnapshot(`
      [
        "a",
        "b",
        "hello",
        "c",
      ]
    `);
  });

  it('can collect distinct values', () => {
    const uniqueA = getUniqueFeatureValues(features, 'a');
    const uniqueB = getUniqueFeatureValues(features, 'b');
    expect(uniqueA).toMatchInlineSnapshot(`
      [
        "1",
        "2",
      ]
    `);
    expect(uniqueB).toMatchInlineSnapshot(`
      [
        "10",
        "20",
        "30",
      ]
    `);
  });
});
