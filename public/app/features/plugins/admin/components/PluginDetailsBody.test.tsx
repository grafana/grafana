import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock } from '../mocks/mockHelpers';
import { PluginTabIds } from '../types';

import { PluginDetailsBody } from './PluginDetailsBody';

function renderWithStore(component: JSX.Element) {
  const store = configureStore();

  return render(<Provider store={store}>{component}</Provider>);
}

describe('PluginDetailsBody', () => {
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
});
