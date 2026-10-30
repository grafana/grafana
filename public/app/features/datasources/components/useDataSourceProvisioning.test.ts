import { renderHook, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { getDataSourceK8sResourceByUid, type DataSourceSettingsK8s } from '../api';

import { useDataSourceProvisioning } from './useDataSourceProvisioning';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  getDataSourceK8sResourceByUid: jest.fn(),
}));

const getResource = jest.mocked(getDataSourceK8sResourceByUid);

let crudApisEnabled = true;
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => crudApisEnabled }),
}));

const resource = { kind: 'DataSource', metadata: { name: 'prom' } } as DataSourceSettingsK8s;

describe('useDataSourceProvisioning', () => {
  const originalProvisioningEnabled = config.provisioningEnabled;

  beforeEach(() => {
    config.provisioningEnabled = true;
    crudApisEnabled = true;
    getResource.mockReset().mockResolvedValue(resource);
  });

  afterAll(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
  });

  it('reads the stored object when provisioning and the CRUD APIs are both on', async () => {
    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toBe(resource);
    expect(getResource).toHaveBeenCalledWith('prom', config.namespace);
  });

  it.each([
    ['provisioning is disabled', () => (config.provisioningEnabled = false)],
    ['the CRUD APIs do not serve the page', () => (crudApisEnabled = false)],
  ])('does not read anything when %s', async (_, disable) => {
    disable();

    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toBeUndefined();
    expect(getResource).not.toHaveBeenCalled();
  });

  // A data source whose group is not served (the CRUD APIs registered no group for its plugin)
  // must still render its settings page, just without the provisioning surfaces.
  it('resolves to no resource when the read fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getResource.mockRejectedValue(new Error('no such group'));

    const { result } = renderHook(() => useDataSourceProvisioning('prom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resource).toBeUndefined();
  });
});
