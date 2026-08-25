import { renderHook, waitFor } from 'test/test-utils';

import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { useCanManageGlobalVariables } from './useCanManageGlobalVariables';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

describe('useCanManageGlobalVariables', () => {
  const originalHasRole = contextSrv.hasRole;

  afterEach(() => {
    contextSrv.hasRole = originalHasRole;
    jest.restoreAllMocks();
  });

  it('becomes true when the writer role grants variables:create on folders:*', async () => {
    contextSrv.hasRole = jest.fn(() => false);
    jest.mocked(getBackendSrv).mockReturnValue({
      get: jest.fn().mockResolvedValue({ 'variables:create': ['folders:*'] }),
    } as unknown as ReturnType<typeof getBackendSrv>);

    const { result } = renderHook(() => useCanManageGlobalVariables());

    expect(result.current).toBe(false);
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('stays false when variables:create is only folder-scoped', async () => {
    contextSrv.hasRole = jest.fn(() => false);
    jest.mocked(getBackendSrv).mockReturnValue({
      get: jest.fn().mockResolvedValue({ 'variables:create': ['folders:uid:folder-a'] }),
    } as unknown as ReturnType<typeof getBackendSrv>);

    const { result } = renderHook(() => useCanManageGlobalVariables());

    await waitFor(() => {
      expect(jest.mocked(getBackendSrv)().get).toHaveBeenCalledWith('/api/access-control/user/permissions');
    });
    expect(result.current).toBe(false);
  });
});
