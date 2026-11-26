import { resolveAPIBaseURL as stableResolveAPIBaseURL, getBackendSrv } from '@grafana/runtime';

import { resolveAPIBaseURL } from './resolveAPIBaseURL';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  resolveAPIBaseURL: jest.fn(),
  getBackendSrv: jest.fn(),
}));

const mockStableResolveAPIBaseURL = jest.mocked(stableResolveAPIBaseURL);

describe('resolveAPIBaseURL', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableResolveAPIBaseURL.mockResolvedValue('/apis/dashboard.grafana.app/v1beta1');
  });

  it('should prefer the stable export', async () => {
    const supported = ['v1beta1'];

    await expect(resolveAPIBaseURL('dashboard.grafana.app', supported, { namespaced: false })).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1'
    );

    expect(mockStableResolveAPIBaseURL).toHaveBeenCalledWith('dashboard.grafana.app', supported, {
      namespaced: false,
    });
    expect(getBackendSrv).not.toHaveBeenCalled();
  });

  it('should forward omitted options as undefined', async () => {
    await resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1']);

    expect(mockStableResolveAPIBaseURL).toHaveBeenCalledWith('dashboard.grafana.app', ['v1beta1'], undefined);
  });
});
