import { getCenterPointWGS84 } from 'app/features/transformers/spatial/utils';

import { getGazetteer } from './gazetteer';

const geojsonObject = {
  type: 'FeatureCollection',
  features: [
    {
      id: 'A',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [0, 0],
      },
      properties: {
        hello: 'A',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [1, 1],
      },
      properties: {
        some_code: 'B',
        hello: 'B',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [2, 2],
      },
      properties: {
        an_id: 'C',
        hello: 'C',
      },
    },
  ],
};

describe('Placename lookup from geojson format', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  it('can lookup by id', async () => {
    const gaz = await getGazetteer('local');
    expect(gaz.error).toBeUndefined();
    expect(getCenterPointWGS84(gaz.find('A')?.geometry())).toMatchInlineSnapshot(`
      [
        0,
        0,
      ]
    `);
  });
  it('can look up by a code', async () => {
    const gaz = await getGazetteer('airports');
    expect(gaz.error).toBeUndefined();
    expect(getCenterPointWGS84(gaz.find('B')?.geometry())).toMatchInlineSnapshot(`
      [
        1,
        1,
      ]
    `);
  });

  it('can look up by an id property', async () => {
    const gaz = await getGazetteer('airports');
    expect(gaz.error).toBeUndefined();
    expect(getCenterPointWGS84(gaz.find('C')?.geometry())).toMatchInlineSnapshot(`
      [
        2,
        2,
      ]
    `);
  });
});
