import { toLonLat } from 'ol/proj';

import countriesJSON from '../../../../gazetteer/countries.json';

import { getGazetteer } from './gazetteer';

const backendResults: Record<string, string> | Array<Record<string, unknown>> = countriesJSON;

describe('Placename lookup from worldmap format', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(backendResults),
    } as unknown as Response);
  });

  // Jest is not configured to restore mocks between tests, so the fetch spy has to be undone here.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('unified worldmap config', async () => {
    const gaz = await getGazetteer('countries');
    expect(gaz.error).toBeUndefined();
    expect(toLonLat(gaz.find('US')?.point()?.getCoordinates()!)).toMatchInlineSnapshot(`
      [
        -95.712891,
        37.09023999999998,
      ]
    `);
    // Items with 'keys' should get allow looking them up
    expect(gaz.find('US')).toEqual(gaz.find('USA'));
  });

  it('exposes a frame and row index so fields can be looked up', async () => {
    // getGazetteer caches by path in a module-level registry, so this is the same instance the
    // test above loaded rather than a second fetch.
    const gaz = await getGazetteer('countries');
    expect(gaz.error).toBeUndefined();

    const frame = gaz.frame?.();
    expect(frame).toBeDefined();
    expect(frame!.length).toBe(gaz.count);

    const found = gaz.find('FR');
    expect(found?.index).toBeDefined();
    expect(frame!.fields.map((f) => [f.name, f.values[found!.index!]])).toEqual([
      ['id', 'FR'],
      ['name', 'France'],
      ['lng', 2.213749],
      ['lat', 46.227638],
    ]);
  });
});
