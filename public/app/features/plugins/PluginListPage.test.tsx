import React from 'react';
import { PluginListPage, Props } from './PluginListPage';
import { NavModel, PluginErrorCode, PluginMeta } from '@grafana/data';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setPluginsSearchQuery } from './state/reducers';
import { render, screen, waitFor } from '@testing-library/react';
import { selectors } from '@grafana/e2e-selectors';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Plugins',
      },
    } as NavModel,
    plugins: [] as PluginMeta[],
    searchQuery: '',
    setPluginsSearchQuery: mockToolkitActionCreator(setPluginsSearchQuery),
    loadPlugins: jest.fn(),
    hasFetched: false,
  };

  Object.assign(props, propOverrides);

  return render(<PluginListPage {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    setup();
    expect(screen.queryByLabelText(selectors.pages.PluginsList.page)).toBeInTheDocument();
    expect(screen.queryByLabelText(selectors.pages.PluginsList.list)).not.toBeInTheDocument();
  });

  it('should render list', async () => {
    setup({
      hasFetched: true,
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(selectors.pages.PluginsList.list)).toBeInTheDocument();
      expect(screen.queryByLabelText(selectors.pages.PluginsList.signatureErrorNotice)).not.toBeInTheDocument();
    });
  });

  describe('Plugin signature errors', () => {
    it('should render notice if there are plugins with signing errors', async () => {
      setup({
        hasFetched: true,
        plugins: [
          {
            id: 'plugin-with-invalid-sig',
            info: {
              logos: { small: 'url' },
              author: { name: 'James Dean' },
            },
          },
        ],
        errors: [
          {
            pluginId: 'plugin-with-invalid-sig',
            errorCode: PluginErrorCode.invalidSignature,
          },
        ],
      });

      await waitFor(() => {
        expect(screen.queryByLabelText(selectors.pages.PluginsList.signatureErrorNotice)).toBeInTheDocument();
      });
    });
  });
});
