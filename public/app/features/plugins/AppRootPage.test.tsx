import { render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { StoreState } from 'app/types';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import AppRootPage from './AppRootPage';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin } from './plugin_loader';
import { getMockPlugin } from './__mocks__/pluginMocks';
import { AppPlugin, PluginType, AppRootProps, NavModelItem } from '@grafana/data';

jest.mock('./PluginSettingsCache', () => ({
  getPluginSettings: jest.fn(),
}));
jest.mock('./plugin_loader', () => ({
  importAppPlugin: jest.fn(),
}));

const importAppPluginMock = importAppPlugin as jest.Mock<
  ReturnType<typeof importAppPlugin>,
  Parameters<typeof importAppPlugin>
>;

const getPluginSettingsMock = getPluginSettings as jest.Mock<
  ReturnType<typeof getPluginSettings>,
  Parameters<typeof getPluginSettings>
>;

const initialState: Partial<StoreState> = {
  location: {
    routeParams: {
      pluginId: 'my-awesome-plugin',
      slug: 'my-awesome-plugin',
    },
    query: {},
    path: '/a/my-awesome-plugin',
    url: '',
    replace: false,
    lastUpdated: 1,
  },
};

function renderWithStore(soreState: Partial<StoreState> = initialState) {
  const store = configureStore<StoreState>()(soreState as StoreState);
  render(
    <Provider store={store}>
      <AppRootPage />
    </Provider>
  );
  return store;
}

describe('AppRootPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should not mount plugin twice if nav is changed', async () => {
    // reproduces https://github.com/grafana/grafana/pull/28105

    getPluginSettingsMock.mockResolvedValue(
      getMockPlugin({
        type: PluginType.app,
        enabled: true,
      })
    );

    let timesMounted = 0;

    // a very basic component that does what most plugins do:
    // immediately update nav on mounting
    class RootComponent extends Component<AppRootProps> {
      componentDidMount() {
        timesMounted++;
        const node: NavModelItem = {
          text: 'My Great plugin',
          children: [
            {
              text: 'A page',
              url: '/apage',
              id: 'a',
            },
            {
              text: 'Another page',
              url: '/anotherpage',
              id: 'b',
            },
          ],
        };
        this.props.onNavChanged({
          main: node,
          node,
        });
      }
      render() {
        return <p>my great plugin</p>;
      }
    }

    const plugin = new AppPlugin();
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    renderWithStore();

    // check that plugin and nav links were rendered, and plugin is mounted only once
    await screen.findByText('my great plugin');
    await screen.findByRole('link', { name: /A page/ });
    await screen.findByRole('link', { name: /Another page/ });
    expect(timesMounted).toEqual(1);
  });
});
