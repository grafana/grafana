import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { AdvisorRedirectNotice } from './AdvisorRedirectNotice';

const originalFeatureToggleValue = config.featureToggles.grafanaAdvisor;
jest.mock('@grafana/runtime/internal', () => ({
  UserStorage: jest.fn().mockImplementation(() => ({
    getItem: jest.fn().mockResolvedValue('true'),
    setItem: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('AdvisorRedirectNotice', () => {
  beforeEach(() => {
    config.featureToggles.grafanaAdvisor = true;
    contextSrv.isGrafanaAdmin = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    config.featureToggles.grafanaAdvisor = originalFeatureToggleValue;
    config.apps['grafana-advisor-app'] = {
      id: 'grafana-advisor-app',
      path: '/a/grafana-advisor-app',
      version: '1.0.0',
      preload: false,
      angular: { detected: false, hideDeprecation: false },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaDependency: '*',
        grafanaVersion: '*',
        plugins: [],
        extensions: { exposedComponents: [] },
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        exposedComponents: [],
        extensionPoints: [],
        addedFunctions: [],
      },
    };
  });

  it('should not render when user is not admin', async () => {
    contextSrv.isGrafanaAdmin = false;
    render(<AdvisorRedirectNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render when feature flag is disabled', async () => {
    config.featureToggles.grafanaAdvisor = false;
    render(<AdvisorRedirectNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should not render when app is not installed', async () => {
    delete config.apps['grafana-advisor-app'];
    render(<AdvisorRedirectNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should render notice with correct content', async () => {
    render(<AdvisorRedirectNotice />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(/Try the new Advisor to uncover potential issues with your data sources and plugins./i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Go to Advisor/i)).toBeInTheDocument();
    });
  });

  it('should dismiss notice when close button is clicked', async () => {
    const { rerender } = render(<AdvisorRedirectNotice />);

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
    rerender(<AdvisorRedirectNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
