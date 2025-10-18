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
});
