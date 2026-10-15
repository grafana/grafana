import { act, render, screen } from 'test/test-utils';

import { PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { DashboardEmptyExtensionPoint } from './DashboardEmptyExtensionPoint';

const renderDefaultUI = () => <div>Default empty state</div>;

beforeEach(() => {
  setPluginComponentsHook(() => ({
    components: [
      createComponentWithMeta(
        {
          title: 'Setup guide empty state',
          component: () => <div>Setup guide empty state</div>,
          pluginId: SETUPGUIDE_PLUGIN_ID,
        },
        PluginExtensionPoints.DashboardEmpty
      ),
    ],
    isLoading: false,
  }));
});

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
});

it('renders the setup guide extension instead of the default UI when enableDashboardEmptyExtensions is on', () => {
  setTestFlags({ enableDashboardEmptyExtensions: true });

  render(<DashboardEmptyExtensionPoint renderDefaultUI={renderDefaultUI} />);

  expect(screen.getByText('Setup guide empty state')).toBeInTheDocument();
  expect(screen.queryByText('Default empty state')).not.toBeInTheDocument();
});

it('renders the default UI and ignores registered extensions when enableDashboardEmptyExtensions is unset', () => {
  render(<DashboardEmptyExtensionPoint renderDefaultUI={renderDefaultUI} />);

  expect(screen.getByText('Default empty state')).toBeInTheDocument();
  expect(screen.queryByText('Setup guide empty state')).not.toBeInTheDocument();
});
