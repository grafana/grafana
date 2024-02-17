import { config } from '@grafana/runtime';

import { getSnapshots } from './SnapshotListTable';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
  config.appUrl = 'http://snapshots.grafana.com/';

  test('returns correct snapshot urls', async () => {
    const results = await getSnapshots();

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "external": true,
          "externalUrl": "https://www.externalSnapshotUrl.com",
          "key": "JRXqfKihKZek70FM6Xaq502NxH7OyyEs",
          "name": "Snap 1",
          "url": "http://snapshots.grafana.com/dashboard/snapshot/JRXqfKihKZek70FM6Xaq502NxH7OyyEs",
        },
        {
          "external": false,
          "externalUrl": "",
          "id": 3,
          "key": "RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j",
          "name": "Snap 2",
          "url": "http://snapshots.grafana.com/dashboard/snapshot/RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j",
        },
      ]
    `);
  });
});
