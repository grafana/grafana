import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { act, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { Provider } from 'react-redux';

import { AppPlugin, PluginType } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { usePluginConfig } from '../hooks/usePluginConfig';
import { getCatalogPluginMock } from '../mocks/mockHelpers';
import { PluginTabIds } from '../types';

import { PluginDetailsBody } from './PluginDetailsBody';

jest.mock('../hooks/usePluginConfig', () => ({
  usePluginConfig: jest.fn(),
}));

const usePluginConfigMock = jest.mocked(usePluginConfig);

function renderWithStore(component: JSX.Element) {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <OpenFeatureTestProvider>{component}</OpenFeatureTestProvider>
    </Provider>
  );
}

describe('PluginDetailsBody', () => {
  beforeEach(() => {
    usePluginConfigMock.mockReturnValue({ value: null, loading: false });
  });

  const tcs = [
    {
      name: 'renderer type plugin',
      plugin: {
        type: PluginType.renderer,
      },
    },
    {
      name: 'enterprise plugin type without enterprise license',
      plugin: {
        isEnterprise: true,
      },
      changeConfig: () => {
        config.licenseInfo.enabledFeatures = {
          'enterprise-plugins': true,
        };
      },
    },
    {
      name: 'unpublished plugin',
      plugin: {
        isPublished: false,
      },
    },
    {
      name: 'core plugin',
      plugin: {
        isCore: true,
      },
    },
    {
      name: 'disabled plugin',
      plugin: {
        isDisabled: true,
      },
    },
    {
      name: 'provisioned plugin',
      plugin: {
        isProvisioned: true,
      },
    },
    {
      name: 'install controls disabled',
      changeConfig: () => {
        config.pluginAdminEnabled = false;
      },
    },
  ];

  tcs.forEach((tc) => {
    it(`should render disable version installation for ${tc.name}`, async () => {
      if (tc.changeConfig) {
        tc.changeConfig();
      }
      const plugin = getCatalogPluginMock({ ...tc.plugin });
      await act(async () => {
        renderWithStore(
          <PluginDetailsBody
            plugin={plugin}
            info={[]}
            queryParams={{}}
            pageId={PluginTabIds.VERSIONS}
            showDetails={false}
          />
        );
      });

      const installSpans = screen.getAllByText('Install');

      installSpans.forEach((span) => {
        const button = span.closest('button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
      });
    });
  });

  it('should render data source connections tab content for installed data source plugin', async () => {
    const plugin = getCatalogPluginMock({ type: PluginType.datasource });
    config.featureToggles.datasourceConnectionsTab = true;
    await act(async () => {
      renderWithStore(
        <PluginDetailsBody
          plugin={plugin}
          info={[]}
          queryParams={{}}
          pageId={PluginTabIds.DATASOURCE_CONNECTIONS}
          showDetails={false}
        />
      );
    });

    expect(screen.getByText('No data sources defined')).toBeVisible();
  });

  it('should mark the plugin boundary on app config pages', async () => {
    const plugin = getCatalogPluginMock({ id: 'my-app', type: PluginType.app });
    const appPlugin = new AppPlugin();
    appPlugin.meta = getMockPlugin({ id: 'my-app', type: PluginType.app });
    appPlugin.addConfigPage({
      title: 'Settings',
      icon: 'cog',
      id: 'settings',
      body: () => <div>Config page body</div>,
    });
    usePluginConfigMock.mockReturnValue({ value: appPlugin, loading: false });

    await act(async () => {
      renderWithStore(
        <PluginDetailsBody plugin={plugin} info={[]} queryParams={{}} pageId="settings" showDetails={false} />
      );
    });

    const boundary = screen.getByTestId(selectors.components.Plugins.configPage('my-app', 'settings'));
    expect(boundary).toHaveAttribute('data-plugin-id', 'my-app');
    expect(screen.getByText('Config page body')).toBeVisible();
  });
});
