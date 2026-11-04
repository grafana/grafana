import { render, screen } from 'test/test-utils';

import { PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { DashboardEmptyExtensionPoint } from './DashboardEmptyExtensionPoint';

const renderDefaultUI = () => <div>Default empty state</div>;

function registerEmptyStateComponent(pluginId: string) {
  setPluginComponentsHook(() => ({
    components: [
      createComponentWithMeta(
        {
          title: 'Plugin empty state',
          component: () => <div>Plugin empty state</div>,
          pluginId,
        },
        PluginExtensionPoints.DashboardEmpty
      ),
    ],
    isLoading: false,
  }));
}

it('renders the setup guide extension instead of the default UI', () => {
  registerEmptyStateComponent(SETUPGUIDE_PLUGIN_ID);

  render(<DashboardEmptyExtensionPoint renderDefaultUI={renderDefaultUI} />);

  expect(screen.getByText('Plugin empty state')).toBeInTheDocument();
  expect(screen.queryByText('Default empty state')).not.toBeInTheDocument();
});

it('renders the default UI when the only registered extension is not from the setup guide app', () => {
  registerEmptyStateComponent('grafana-other-app');

  render(<DashboardEmptyExtensionPoint renderDefaultUI={renderDefaultUI} />);

  expect(screen.getByText('Default empty state')).toBeInTheDocument();
  expect(screen.queryByText('Plugin empty state')).not.toBeInTheDocument();
});
