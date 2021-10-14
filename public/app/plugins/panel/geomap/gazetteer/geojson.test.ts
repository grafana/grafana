import { getGazetteer } from './gazetteer';

let backendResults: any = { hello: 'world' };

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
      id: 'B',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [1, 1],
      },
      properties: {
        hello: 'B',
      },
    },
  ],
};

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue(backendResults),
  }),
}));

describe('Placename lookup from geojson format', () => {
  beforeEach(() => {
    backendResults = { hello: 'world' };
  });

  it('unified worldmap config', async () => {
    backendResults = geojsonObject;
    const gaz = await getGazetteer('local');
    expect(gaz.error).toBeUndefined();
    expect(gaz.find('A')).toMatchInlineSnapshot(`
      Object {
        "coords": Array [
          0, 0,
        ],
        "props": Object {
          "hello": "A",
        },
      }
    `);
  });
});
