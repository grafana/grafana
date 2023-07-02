import { renderHook, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { ReceiversStateDTO } from 'app/types';

import 'whatwg-fetch';

import alertmanagerMock from './mocks/alertmanager.config.mock.json';
import receiversMock from './mocks/receivers.mock.json';
import { useContactPointsWithStatus } from './useContactPoints';

const server = setupServer(
  rest.get(`/api/alertmanager/grafana/config/api/v1/alerts`, (_req, res, ctx) =>
    res(ctx.json<AlertManagerCortexConfig>(alertmanagerMock))
  ),
  rest.get('/api/alertmanager/grafana/config/api/v1/receivers', (_req, res, ctx) =>
    res(ctx.json<ReceiversStateDTO[]>(receiversMock))
  )
);

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('useContactPoints', () => {
  it('should return contact points with status', async () => {
    const { result } = renderHook(() => useContactPointsWithStatus('grafana'), {
      wrapper: TestProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });
});
