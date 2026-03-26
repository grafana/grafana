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

describe('Legacy path rewriting', () => {
  const publicPath = 'https://grafana.fake/public/';
  let isolatedGetGazetteer: typeof getGazetteer;
  let isolatedGazetteerOptions: typeof import('./gazetteer').GAZETTEER_OPTIONS;

  beforeAll(() => {
    window.__grafana_public_path__ = publicPath;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./gazetteer');
      isolatedGetGazetteer = mod.getGazetteer;
      isolatedGazetteerOptions = mod.GAZETTEER_OPTIONS;
    });
  });

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  it.each([
    ['public/gazetteer/countries.json', () => isolatedGazetteerOptions.countries.path],
    ['public/gazetteer/usa-states.json', () => isolatedGazetteerOptions.usaStates.path],
    ['public/gazetteer/airports.geojson', () => isolatedGazetteerOptions.airports.path],
    ['public/gazetteer/custom.json', () => `${publicPath}build/gazetteer/custom.json`],
  ])('rewrites "%s" to "%s"', async (legacyPath, getExpectedUrl) => {
    const expectedUrl = getExpectedUrl();
    const gaz = await isolatedGetGazetteer(legacyPath);
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    expect(gaz.path).toBe(expectedUrl);
  });

  it('does not rewrite absolute http URLs', async () => {
    const url = 'https://example.com/my-gazetteer.json';
    await isolatedGetGazetteer(url);
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
