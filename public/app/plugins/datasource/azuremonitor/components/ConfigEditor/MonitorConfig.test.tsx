import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { useBatchAPIFlag } from '../../featureFlags';
import { createMockDatasourceSettings } from '../../mocks/datasourceSettings';

import { MonitorConfig, type Props } from './MonitorConfig';

jest.mock('../../featureFlags', () => ({
  useBatchAPIFlag: jest.fn().mockReturnValue(false),
  isBatchAPIFlagEnabled: jest.fn().mockReturnValue(false),
  initFeatureFlags: jest.fn(),
}));

const defaultProps: Props = {
  options: createMockDatasourceSettings(),
  updateOptions: jest.fn(),
  getSubscriptions: jest.fn().mockResolvedValue([]),
};

describe('MonitorConfig', () => {
  beforeEach(() => {
    config.azure = {
      ...config.azure,
      managedIdentityEnabled: false,
      workloadIdentityEnabled: false,
      userIdentityEnabled: false,
    };
    config.featureToggles = {
      azureMonitorEnableUserAuth: false,
    };
    // clearAllMocks does not restore return values; reset so a per-test mockReturnValue(true) cannot leak
    jest.mocked(useBatchAPIFlag).mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('should render component', () => {
    render(<MonitorConfig {...defaultProps} />);
    expect(screen.getByText('Azure Cloud')).toBeInTheDocument();
  });

  it('should render component and set the default auth type if unset', () => {
    const mockDsSettingsWithoutAuth = createMockDatasourceSettings({
      jsonData: { azureAuthType: undefined, clientId: undefined, tenantId: undefined },
    });

    render(<MonitorConfig {...defaultProps} options={mockDsSettingsWithoutAuth} />);

    expect(defaultProps.updateOptions).toHaveBeenCalled();
    expect(screen.getByText('Azure Cloud')).toBeInTheDocument();
  });

  expect(defaultProps.options.jsonData.azureAuthType).toBe('clientsecret');

  it('should render component and set the default subscription if specified', async () => {
    const mockDsSettingsWithAuth = createMockDatasourceSettings(undefined, { clientSecret: true });
    const getSubscriptions = jest.fn().mockResolvedValue([{ label: 'Test Sub', value: 'ghi-789' }]);
    render(<MonitorConfig {...defaultProps} options={mockDsSettingsWithAuth} getSubscriptions={getSubscriptions} />);

    expect(screen.getByText('Azure Cloud')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Test Sub')).toBeInTheDocument());
  });

  it('should render with user identity enabled when feature toggle is true', async () => {
    config.azure.userIdentityEnabled = true;
    config.featureToggles.azureMonitorEnableUserAuth = true;

    const optionsWithUserAuth = createMockDatasourceSettings({
      jsonData: { azureAuthType: 'currentuser' },
    });

    render(<MonitorConfig {...defaultProps} options={optionsWithUserAuth} />);

    const authDropdownInput = screen.getByTestId('data-testid auth-type').querySelector('input');

    if (authDropdownInput) {
      fireEvent.mouseDown(authDropdownInput);
    }

    await waitFor(() => {
      expect(
        screen.getByText(
          (content, element) => element?.tagName?.toLowerCase() === 'span' && /Current User/i.test(content)
        )
      ).toBeInTheDocument();
    });
  });

  it('should render with user identity disabled when feature toggle is false', async () => {
    config.azure.userIdentityEnabled = true;
    config.featureToggles.azureMonitorEnableUserAuth = false;

    render(<MonitorConfig {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Authentication type')).toBeInTheDocument();
      expect(screen.queryByText(/Current User/i)).not.toBeInTheDocument();
    });
  });

  it('should show the Batch API toggle when the azureMonitorBatchAPI feature flag is enabled', () => {
    jest.mocked(useBatchAPIFlag).mockReturnValue(true);

    render(<MonitorConfig {...defaultProps} />);

    expect(screen.getByText('Enable Batch API')).toBeInTheDocument();
  });

  it('should hide the Batch API toggle when the azureMonitorBatchAPI feature flag is disabled', () => {
    jest.mocked(useBatchAPIFlag).mockReturnValue(false);

    render(<MonitorConfig {...defaultProps} />);

    expect(screen.queryByText('Enable Batch API')).not.toBeInTheDocument();
  });
});
