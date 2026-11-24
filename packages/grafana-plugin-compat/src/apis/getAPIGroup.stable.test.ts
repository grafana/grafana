import { getAPIGroup as stableGetAPIGroup, getBackendSrv } from '@grafana/runtime';

import { getAPIGroup } from './getAPIGroup';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAPIGroup: jest.fn(),
  getBackendSrv: jest.fn(),
}));

const mockStableGetAPIGroup = jest.mocked(stableGetAPIGroup);

const dashboardInfo = {
  group: 'dashboard.grafana.app',
  versions: ['v1beta1', 'v0alpha1'],
  preferredVersion: 'v1beta1',
};

describe('getAPIGroup', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetAPIGroup.mockResolvedValue(dashboardInfo);
  });

  it('should prefer the stable export', async () => {
    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBe(dashboardInfo);

    expect(mockStableGetAPIGroup).toHaveBeenCalledWith('dashboard.grafana.app');
    expect(getBackendSrv).not.toHaveBeenCalled();
  });

  it('should pass through undefined from the stable export', async () => {
    mockStableGetAPIGroup.mockResolvedValue(undefined);

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
  });
});
