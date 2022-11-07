import { of } from 'rxjs';

import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';

import { getDataSourceByIdOrUid } from './api';

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: jest.fn(),
}));

const mockResponse = (response: Partial<FetchResponse>) => {
  (getBackendSrv as jest.Mock).mockReturnValueOnce({
    fetch: (options: BackendSrvRequest) => {
      return of(response as FetchResponse);
    },
  });
};

describe('Datasources / API', () => {
  describe('getDataSourceByIdOrUid()', () => {
    it('should resolve to the datasource object in case it is fetched using a UID', async () => {
      const response = {
        ok: true,
        data: {
          id: 111,
          uid: 'abcdefg',
        },
      };
      mockResponse(response);

      expect(await getDataSourceByIdOrUid(response.data.uid)).toBe(response.data);
    });
  });
});
