import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';

import AssistantOnboardingPage from './AssistantOnboardingPage';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

describe('AssistantOnboardingPage', () => {
  const originalAppSubUrl = config.appSubUrl;

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
  });

  it('renders the install CTA pointing at the plugin catalog', () => {
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
    config.appSubUrl = '/grafana';

    render(
      <TestProvider>
        <AssistantOnboardingPage />
      </TestProvider>
    );

    const cta = screen.getByRole('link', { name: /install grafana assistant/i });
    expect(cta).toHaveAttribute('href', `/grafana/plugins/${ASSISTANT_PLUGIN_ID}`);
  });
});
