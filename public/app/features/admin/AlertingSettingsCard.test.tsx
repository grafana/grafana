import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { AlertingSettingsCard } from './AlertingSettingsCard';

describe('AlertingSettingsCard', () => {
  const originalEnabled = config.unifiedAlertingEnabled;
  const originalUIEnabled = config.unifiedAlertingUIEnabled;

  afterEach(() => {
    config.unifiedAlertingEnabled = originalEnabled;
    config.unifiedAlertingUIEnabled = originalUIEnabled;
  });

  it('shows the disable snippet when alerting is enabled', () => {
    config.unifiedAlertingEnabled = true;
    config.unifiedAlertingUIEnabled = true;
    render(<AlertingSettingsCard />);

    expect(screen.getByText('Enabled')).toBeInTheDocument();
    const [backendSnippet, uiSnippet] = screen.getAllByText(/\[unified_alerting\]/);
    expect(backendSnippet).toHaveTextContent('enabled = false');
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(uiSnippet).toHaveTextContent('ui_enabled = false');
  });

  it('shows the enable snippet when alerting is disabled', () => {
    config.unifiedAlertingEnabled = false;
    config.unifiedAlertingUIEnabled = false;
    render(<AlertingSettingsCard />);

    expect(screen.getByText('Disabled')).toBeInTheDocument();
    const [backendSnippet, uiSnippet] = screen.getAllByText(/\[unified_alerting\]/);
    expect(backendSnippet).toHaveTextContent('enabled = true');
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(uiSnippet).toHaveTextContent('ui_enabled = true');
  });
});
