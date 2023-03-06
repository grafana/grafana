import { toLonLat } from 'ol/proj';

import countriesJSON from '../../../../gazetteer/countries.json';

import { getGazetteer } from './gazetteer';

let backendResults: any = { hello: 'world' };

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue(backendResults),
  }),
}));

describe('Placename lookup from worldmap format', () => {
  beforeEach(() => {
    backendResults = { hello: 'world' };
  });

  it('unified worldmap config', async () => {
    backendResults = countriesJSON;
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
