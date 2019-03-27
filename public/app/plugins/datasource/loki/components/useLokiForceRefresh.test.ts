import { DatasourceStatus } from '@grafana/ui/src/types/plugin';

import { renderHook } from 'react-hooks-testing-library';
import { useLokiForceRefresh } from './useLokiForceRefresh';

describe('useLokiForceRefresh hook', () => {
  it('should force refresh labels after reconnect', async () => {
    const refreshLabelsMock = jest.fn();
    const previousStatus = DatasourceStatus.Disconnected;
    const currentStatus = DatasourceStatus.Connected;
    renderHook(() => useLokiForceRefresh(currentStatus, refreshLabelsMock, previousStatus));

    expect(refreshLabelsMock).toBeCalledWith(true);
  });

  it('should not refresh labels otherwise', async () => {
    const refreshLabelsMock = jest.fn();
    const previousStatus = DatasourceStatus.Connected;
    const currentStatus = DatasourceStatus.Disconnected;
    renderHook(() => useLokiForceRefresh(currentStatus, refreshLabelsMock, previousStatus));

    expect(refreshLabelsMock).not.toBeCalled();
  });
});
