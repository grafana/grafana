import { resolveAPIVersion as stableResolveAPIVersion, getBackendSrv } from '@grafana/runtime';

import { resolveAPIVersion } from './resolveAPIVersion';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  resolveAPIVersion: jest.fn(),
  getBackendSrv: jest.fn(),
}));

const mockStableResolveAPIVersion = jest.mocked(stableResolveAPIVersion);

describe('resolveAPIVersion', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableResolveAPIVersion.mockResolvedValue('v1beta1');
  });

  it('should prefer the stable export', async () => {
    const supported = ['v0alpha1', 'v1beta1'];

    await expect(resolveAPIVersion('dashboard.grafana.app', supported)).resolves.toBe('v1beta1');

    expect(mockStableResolveAPIVersion).toHaveBeenCalledWith('dashboard.grafana.app', supported);
    expect(getBackendSrv).not.toHaveBeenCalled();
  });
});
