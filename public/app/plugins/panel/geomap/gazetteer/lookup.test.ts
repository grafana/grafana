import { getPlacenameLookup } from './lookup';

let backendResults: any = { hello: 'world' };
import countriesJSON from '../../../../../placenames/worldmap-countries.json';

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

  it('legacy worldmap', () => {
    backendResults = countriesJSON;
    const v = getPlacenameLookup('countries');
    expect(v.error).toBeUndefined();
    expect(v.examples(10)).toMatchInlineSnapshot();
  });
});
