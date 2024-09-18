import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { createMockDatasourceSettings } from '../../__mocks__/datasourceSettings';

import { MonitorConfig, Props } from './MonitorConfig';

const mockDatasourceSettings = createMockDatasourceSettings();

const defaultProps: Props = {
  options: mockDatasourceSettings,
  updateOptions: jest.fn(),
  getSubscriptions: jest.fn().mockResolvedValue([]),
};

describe('MonitorConfig', () => {
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
});
