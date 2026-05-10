import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import AssistantOnboardingPage from './AssistantOnboardingPage';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

describe('AssistantOnboardingPage', () => {
  let hasPermissionSpy: jest.SpyInstance;
  const originalAppSubUrl = config.appSubUrl;

  beforeEach(() => {
    hasPermissionSpy = jest.spyOn(contextSrv, 'hasPermission');
  });

  afterEach(() => {
    hasPermissionSpy.mockRestore();
    config.appSubUrl = originalAppSubUrl;
  });

  it('renders the install CTA when the user has plugins:install', () => {
    hasPermissionSpy.mockReturnValue(true);

    render(
      <TestProvider>
        <AssistantOnboardingPage />
      </TestProvider>
    );

    const cta = screen.getByRole('link', { name: /install grafana assistant/i });
    expect(cta).toBeVisible();
    expect(cta).toHaveAttribute('href', `/plugins/${ASSISTANT_PLUGIN_ID}`);
    expect(screen.getByRole('heading', { name: /grafana assistant/i })).toBeVisible();
  });

  it('prefixes the install link with appSubUrl for subpath deployments', () => {
    hasPermissionSpy.mockReturnValue(true);
    config.appSubUrl = '/grafana';

    render(
      <TestProvider>
        <AssistantOnboardingPage />
      </TestProvider>
    );

    const cta = screen.getByRole('link', { name: /install grafana assistant/i });
    expect(cta).toHaveAttribute('href', `/grafana/plugins/${ASSISTANT_PLUGIN_ID}`);
  });

  it('hides the install CTA and shows admin-help copy when the user lacks plugins:install', () => {
    hasPermissionSpy.mockReturnValue(false);

    render(
      <TestProvider>
        <AssistantOnboardingPage />
      </TestProvider>
    );

    expect(screen.queryByRole('link', { name: /install grafana assistant/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ask a grafana administrator/i)).toBeVisible();
  });
});
