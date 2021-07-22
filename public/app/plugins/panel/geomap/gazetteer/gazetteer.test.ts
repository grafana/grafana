import { getGazetteer } from './gazetteer';

let backendResults: any = { hello: 'world' };
import countriesJSON from '../../../../../gazetteer/worldmap-countries.json';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue(backendResults),
  }),
}));

describe('Placename lookups', () => {
  beforeEach(() => {
    backendResults = { hello: 'world' };
  });

  it('legacy worldmap', async () => {
    backendResults = countriesJSON;
    const v = await getGazetteer('countries');
    expect(v.error).toBeUndefined();
    expect(v.find('US')).toMatchInlineSnapshot(`
      Object {
        "coords": Array [
          -95.712891,
          37.09024,
        ],
        "props": Object {
          "name": "United States",
        },
      }
    `);
  });
});
