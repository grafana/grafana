import { locationService } from '@grafana/runtime';

import { getSnapshots } from './SnapshotListTable';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue([
      {
        name: 'Snap 1',
        key: 'JRXqfKihKZek70FM6Xaq502NxH7OyyEs',
        external: true,
        externalUrl: 'https://www.externalSnapshotUrl.com',
      },
      {
        id: 3,
        name: 'Snap 2',
        key: 'RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j',
        external: false,
        externalUrl: '',
      },
    ]),
  }),
}));

describe('getSnapshots', () => {
  (global as any).window = Object.create(window);
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000/grafana/dashboard/snapshots',
    },
    writable: true,
  });

  locationService.push('/dashboard/snapshots');

  test('returns correct snapshot urls', async () => {
    const results = await getSnapshots();

    expect(results).toMatchInlineSnapshot(`
      Array [
        Object {
          "external": true,
          "externalUrl": "https://www.externalSnapshotUrl.com",
          "key": "JRXqfKihKZek70FM6Xaq502NxH7OyyEs",
          "name": "Snap 1",
          "url": "/dashboard/snapshot/JRXqfKihKZek70FM6Xaq502NxH7OyyEs",
        },
        Object {
          "external": false,
          "externalUrl": "",
          "id": 3,
          "key": "RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j",
          "name": "Snap 2",
          "url": "/dashboard/snapshot/RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j",
        },
      ]
    `);
  });
});
