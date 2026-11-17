import { renderHook, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';

import { useDataSourceProvisioning } from './useDataSourceProvisioning';

jest.mock('app/core/services/backend_srv', () => ({
  ...jest.requireActual('app/core/services/backend_srv'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();
jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);

let crudApisEnabled = true;
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => crudApisEnabled }),
}));

const annotations = { 'grafana.app/managedBy': 'repo', 'grafana.app/managerId': 'my-repo' };

describe('useDataSourceProvisioning', () => {
  const originalProvisioningEnabled = config.provisioningEnabled;

  beforeEach(() => {
    config.provisioningEnabled = true;
    crudApisEnabled = true;
    get.mockReset().mockResolvedValue({ items: [{ name: 'prom', annotations }] });
  });

  afterAll(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
  });

  // Connections is answered from the collection in unified storage, unlike a per-type read, which
  // goes through the dual writer and below mode 4 returns the legacy row with no annotations.
  it('reads the manager annotations from the connections endpoint', async () => {
    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toEqual({ metadata: { annotations } });
    expect(get).toHaveBeenCalledWith(
      `/apis/query.grafana.app/v0alpha1/namespaces/${config.namespace}/connections`,
      { name: 'prom' },
      undefined,
      { showErrorAlert: false }
    );
  });

  it.each([
    ['provisioning is disabled', () => (config.provisioningEnabled = false)],
    ['the CRUD APIs do not serve the page', () => (crudApisEnabled = false)],
  ])('does not read anything when %s', async (_, disable) => {
    disable();

    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it('resolves to no resource when the data source is not managed', async () => {
    get.mockResolvedValue({ items: [{ name: 'prom' }] });

    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toBeUndefined();
  });

  // The settings page has to render regardless; an unreadable connection only costs the badge.
  it('resolves to no resource when the read fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    get.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toBeUndefined();
  });
});
