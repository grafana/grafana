import { getCenterPointWGS84 } from 'app/features/transformers/spatial/utils';

import { getGazetteer, GAZETTEER_OPTIONS } from './gazetteer';

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

const publicPath = 'https://grafana.fake/public/';

describe('Legacy path rewriting', () => {
  beforeAll(() => {
    window.__grafana_public_path__ = publicPath;
  });

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  it.each([
    ['public/gazetteer/countries.json', `${publicPath}build/gazetteer/countries.json`],
    ['public/gazetteer/usa-states.json', `${publicPath}build/gazetteer/usa-states.json`],
    ['public/gazetteer/airports.geojson', `${publicPath}build/gazetteer/airports.geojson`],
    ['public/gazetteer/custom.json', `${publicPath}build/gazetteer/custom.json`],
  ])('rewrites "%s" to "%s"', async (legacyPath, expectedUrl) => {
    const gaz = await getGazetteer(legacyPath);
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    expect(gaz.path).toBe(expectedUrl);
  });

  it('resolves GAZETTEER_OPTIONS paths using the public path', () => {
    expect(GAZETTEER_OPTIONS.countries.path).toBe(`${publicPath}build/gazetteer/countries.json`);
    expect(GAZETTEER_OPTIONS.usaStates.path).toBe(`${publicPath}build/gazetteer/usa-states.json`);
    expect(GAZETTEER_OPTIONS.airports.path).toBe(`${publicPath}build/gazetteer/airports.geojson`);
  });

  it('does not rewrite absolute http URLs', async () => {
    const url = 'https://example.com/my-gazetteer.json';
    await getGazetteer(url);
    expect(fetch).toHaveBeenCalledWith(url);
  });
});

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
