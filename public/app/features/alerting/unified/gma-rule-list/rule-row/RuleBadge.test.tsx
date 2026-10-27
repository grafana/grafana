import { render, screen } from 'test/test-utils';

import { RuleBadge } from './RuleBadge';

// PluginOriginBadge loads plugin settings async; stub it for badge-logic tests.
jest.mock('../../plugins/PluginOriginBadge', () => ({
  PluginOriginBadge: ({ pluginId }: { pluginId: string }) => <span data-testid="plugin-badge">{pluginId}</span>,
}));

function makeRule(overrides: { labels?: Record<string, string>; annotations?: Record<string, string> }) {
  return {
    spec: { labels: overrides.labels },
    metadata: { annotations: overrides.annotations },
  };
}

describe('RuleBadge', () => {
  it('renders the plugin badge when __grafana_origin starts with plugin/', () => {
    render(<RuleBadge rule={makeRule({ labels: { __grafana_origin: 'plugin/grafana-ml-app' } })} />);

    expect(screen.getByTestId('plugin-badge')).toHaveTextContent('grafana-ml-app');
  });

  it('extracts the plugin ID after the plugin/ prefix', () => {
    render(<RuleBadge rule={makeRule({ labels: { __grafana_origin: 'plugin/my-cool-plugin' } })} />);

    expect(screen.getByTestId('plugin-badge')).toHaveTextContent('my-cool-plugin');
  });

  it('renders the provisioning badge when provenance is set and no plugin origin', () => {
    render(<RuleBadge rule={makeRule({ annotations: { 'grafana.com/provenance': 'terraform' } })} />);

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it('renders the plugin badge and not the provisioning badge when both apply', () => {
    render(
      <RuleBadge
        rule={makeRule({
          labels: { __grafana_origin: 'plugin/grafana-ml-app' },
          annotations: { 'grafana.com/provenance': 'terraform' },
        })}
      />
    );

    expect(screen.getByTestId('plugin-badge')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('renders nothing when neither plugin origin nor provenance is set', () => {
    const { container } = render(<RuleBadge rule={makeRule({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when __grafana_origin does not start with plugin/', () => {
    render(<RuleBadge rule={makeRule({ labels: { __grafana_origin: 'terraform' } })} />);

    expect(screen.queryByTestId('plugin-badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
