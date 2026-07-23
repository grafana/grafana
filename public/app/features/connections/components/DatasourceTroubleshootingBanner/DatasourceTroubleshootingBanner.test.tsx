import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAppPluginInstalled } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { DatasourceTroubleshootingBanner } from './DatasourceTroubleshootingBanner';

jest.mock('@grafana/runtime/internal', () => ({
  UserStorage: jest.fn().mockImplementation(() => ({
    getItem: jest.fn().mockResolvedValue('true'),
    setItem: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useAppPluginInstalled: jest.fn(),
}));

const useAppPluginInstalledMock = jest.mocked(useAppPluginInstalled);

describe('DatasourceTroubleshootingBanner', () => {
  beforeEach(() => {
    contextSrv.isGrafanaAdmin = true;
    useAppPluginInstalledMock.mockReturnValue({ loading: false, value: true, error: undefined });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when user is not admin', async () => {
    contextSrv.isGrafanaAdmin = false;
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render when app is not installed', async () => {
    useAppPluginInstalledMock.mockReturnValue({ loading: false, value: false, error: undefined });
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render while useAppPluginInstalled is loading', async () => {
    useAppPluginInstalledMock.mockReturnValue({ loading: true, value: undefined, error: undefined });
    render(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should render notice with correct content', async () => {
    render(<DatasourceTroubleshootingBanner />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(/Try the new Advisor to uncover potential issues with your data sources and plugins./i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Go to Advisor/i)).toBeInTheDocument();
    });
  });

  it('should dismiss notice when close button is clicked', async () => {
    const { rerender } = render(<DatasourceTroubleshootingBanner />);

    await waitFor(() => {
      expect(
        screen.getByText(/Try the new Advisor to uncover potential issues with your data sources and plugins./i)
      ).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close alert/i });

    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByText(/Try the new Advisor to uncover potential issues with your data sources and plugins./i)
      ).not.toBeInTheDocument();
    });

    // Re-render the component and check that the notice is not rendered
    rerender(<DatasourceTroubleshootingBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
