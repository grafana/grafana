import { render, screen } from '@testing-library/react';

import { useHasDataSourceInstance } from '@grafana/runtime/unstable';

import { XrayLinkConfig } from './XrayLinkConfig';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  DataSourcePicker: () => <></>,
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useHasDataSourceInstance: jest.fn(),
}));

const missingDataSourceText = /There is no Application Signals datasource to link to/;

describe('XrayLinkConfig', () => {
  it('should show an alert when there is no Application Signals data source', () => {
    jest.mocked(useHasDataSourceInstance).mockReturnValue({ isLoading: false, hasInstance: false });
    render(<XrayLinkConfig onChange={jest.fn()} />);
    expect(screen.getByText(missingDataSourceText)).toBeInTheDocument();
  });

  it('should not show the alert while the data source list is loading', () => {
    jest.mocked(useHasDataSourceInstance).mockReturnValue({ isLoading: true, hasInstance: false });
    render(<XrayLinkConfig onChange={jest.fn()} />);
    expect(screen.queryByText(missingDataSourceText)).not.toBeInTheDocument();
  });

  it('should not show the alert when the data source lookup fails', () => {
    jest.mocked(useHasDataSourceInstance).mockReturnValue({
      isLoading: false,
      hasInstance: false,
      error: new Error('lookup failed'),
    });
    render(<XrayLinkConfig onChange={jest.fn()} />);
    expect(screen.queryByText(missingDataSourceText)).not.toBeInTheDocument();
  });

  it('should not show the alert when an Application Signals data source exists', () => {
    jest.mocked(useHasDataSourceInstance).mockReturnValue({ isLoading: false, hasInstance: true });
    render(<XrayLinkConfig onChange={jest.fn()} />);
    expect(screen.queryByText(missingDataSourceText)).not.toBeInTheDocument();
  });
});
