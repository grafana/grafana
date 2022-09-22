import { act, render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { AppPlugin, PluginType, AppRootProps, NavModelItem } from '@grafana/data';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
import { configureStore } from 'app/store/configureStore';

import { getMockPlugin } from '../__mocks__/pluginMocks';
import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';

import AppRootPage from './AppRootPage';

jest.mock('../pluginSettings', () => ({
  getPluginSettings: jest.fn(),
}));
jest.mock('../plugin_loader', () => ({
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

class RootComponent extends Component<AppRootProps> {
  static timesMounted = 0;
  componentDidMount() {
    RootComponent.timesMounted += 1;
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

function renderUnderRouter() {
  const store = configureStore();
  const route = { component: AppRootPage };
  locationService.push('/a/my-awesome-plugin');

  render(
    <Router history={locationService.getHistory()}>
      <Provider store={store}>
        <GrafanaContext.Provider value={getGrafanaContextMock()}>
          <Route path="/a/:pluginId" exact render={(props) => <GrafanaRoute {...props} route={route as any} />} />
        </GrafanaContext.Provider>
      </Provider>
    </Router>
  );
}

describe('AppRootPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setEchoSrv(new Echo());
  });

  const pluginMeta = getMockPlugin({
    id: 'my-awesome-plugin',
    type: PluginType.app,
    enabled: true,
  });

  it('should not mount plugin twice if nav is changed', async () => {
    // reproduces https://github.com/grafana/grafana/pull/28105
    getPluginSettingsMock.mockResolvedValue(pluginMeta);

    const plugin = new AppPlugin();
    plugin.meta = pluginMeta;
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    renderUnderRouter();

    // check that plugin and nav links were rendered, and plugin is mounted only once
    expect(await screen.findByText('my great plugin')).toBeVisible();
    expect(await screen.findByLabelText('Tab A page')).toBeVisible();
    expect(await screen.findByLabelText('Tab Another page')).toBeVisible();
    expect(RootComponent.timesMounted).toEqual(1);
  });

  it('should not render component if not at plugin path', async () => {
    getPluginSettingsMock.mockResolvedValue(pluginMeta);

    class RootComponent extends Component<AppRootProps> {
      static timesRendered = 0;
      render() {
        RootComponent.timesRendered += 1;
        return <p>my great component</p>;
      }
    }

    const plugin = new AppPlugin();
    plugin.meta = pluginMeta;
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    renderUnderRouter();

    expect(await screen.findByText('my great component')).toBeVisible();

    // renders the first time
    expect(RootComponent.timesRendered).toEqual(2);

    await act(async () => {
      locationService.push('/foo');
    });

    expect(RootComponent.timesRendered).toEqual(2);

    await act(async () => {
      locationService.push('/a/my-awesome-plugin');
    });

    expect(RootComponent.timesRendered).toEqual(4);
  });
});
