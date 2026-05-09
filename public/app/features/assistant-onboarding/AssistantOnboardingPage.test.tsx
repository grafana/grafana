import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import AssistantOnboardingPage from './AssistantOnboardingPage';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

describe('AssistantOnboardingPage', () => {
  it('renders the install CTA pointing at the plugin catalog', async () => {
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
});
