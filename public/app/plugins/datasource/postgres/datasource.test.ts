import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { backendSrv } from 'app/core/services/backend_srv';

import { PostgresDatasource } from './datasource';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as any),
  getBackendSrv: () => backendSrv,
  getTemplateSrv: () => ({
    replace: (val: string): string => {
      return val;
    },
  }),
}));

describe('Postgres datasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when performing testDatasource call', () => {
    it('should return the error from the server', async () => {
      setupFetchMock(
        undefined,
        throwError(() => ({
          status: 400,
          statusText: 'Bad Request',
          data: {
            results: {
              meta: {
                error: 'db query error: pq: password authentication failed for user "postgres"',
                frames: [
                  {
                    schema: {
                      refId: 'meta',
                      meta: {
                        executedQueryString: 'SELECT 1',
                      },
                      fields: [],
                    },
                    data: {
                      values: [],
                    },
                  },
                ],
              },
            },
          },
        }))
      );

      const ds = new PostgresDatasource({ name: '', id: 0, jsonData: {} } as any);
      const result = await ds.testDatasource();
      expect(result.status).toEqual('error');
      expect(result.message).toEqual('db query error: pq: password authentication failed for user "postgres"');
    });
  });
});

function setupFetchMock(response: any, mock?: any) {
  const defaultMock = () => mock ?? of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
  return fetchMock;
}
