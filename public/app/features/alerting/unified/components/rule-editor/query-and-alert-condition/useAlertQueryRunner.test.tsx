import { HttpResponse, http } from 'msw';
import { StrictMode } from 'react';
import { act, renderHook, waitFor } from 'test/test-utils';

import { type DataSourceApi } from '@grafana/data';

import { type AlertDataQuery, type AlertQuery } from '../../../../../../types/unified-alerting-dto';
import { setupMswServer } from '../../../mockApi';
import { mockDataSource } from '../../../mocks';
import { type AlertingQueryResponse } from '../../../state/AlertingQueryRunner';
import { setupDataSources } from '../../../testSetup/datasources';

import { useAlertQueryRunner } from './useAlertQueryRunner';

const DS_UID = 'test-ds-uid';

const server = setupMswServer();

beforeEach(() => {
  const dsrv = setupDataSources(mockDataSource({ uid: DS_UID, name: 'Test DS' }));
  // The real plugin can't be imported in tests; a plain DataSourceApi keeps the query in the run
  jest.spyOn(dsrv, 'get').mockResolvedValue({ uid: DS_UID } as DataSourceApi);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const query: AlertQuery = {
  refId: 'A',
  datasourceUid: DS_UID,
  queryType: '',
  relativeTimeRange: { from: 600, to: 0 },
  model: { refId: 'A' } as AlertDataQuery,
};

describe('useAlertQueryRunner', () => {
  it('returns preview data when rendered in StrictMode', async () => {
    server.use(
      http.post('/api/v1/eval', () =>
        HttpResponse.json<AlertingQueryResponse>({
          results: {
            A: {
              frames: [
                {
                  schema: { refId: 'A', fields: [{ name: 'time' }, { name: 'value' }] },
                  data: { values: [[1000], [42]] },
                },
              ],
            },
          },
        })
      )
    );

    const { result } = renderHook(() => useAlertQueryRunner(), { wrapper: StrictMode });

    await act(() => result.current.runQueries([query], 'A'));

    await waitFor(() => expect(result.current.queryPreviewData.A?.series[0]?.fields[1].values).toEqual([42]));
  });
});
