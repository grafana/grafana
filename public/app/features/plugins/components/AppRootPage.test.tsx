import { act, render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { AppPlugin, PluginType, AppRootProps, NavModelItem } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { RouteDescriptor } from 'app/core/navigation/types';
import { Echo } from 'app/core/services/echo/Echo';
import { configureStore } from 'app/store/configureStore';

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
  static timesRendered = 0;
  render() {
    RootComponent.timesRendered += 1;
    return <p>my great component</p>;
  }
}

function renderUnderRouter() {
  const appPluginNavItem: NavModelItem = {
    text: 'App',
    id: 'plugin-page-app',
    url: '/a/plugin-page-app',
    children: [
      {
        text: 'Page 1',
        url: '/a/plugin-page-app/page-1',
      },
      {
        text: 'Page 2',
        url: '/a/plugin-page-app/page-2',
      },
    ],
  };

  const appsSection = {
    text: 'apps',
    id: 'apps',
    children: [appPluginNavItem],
  };

  appPluginNavItem.parentItem = appsSection;

  const store = configureStore();
  const route = {
    component: () => <AppRootPage pluginId="my-awesome-plugin" pluginNavSection={appsSection} />,
  } as unknown as RouteDescriptor;
  locationService.push('/a/my-awesome-plugin');

  render(
    <Router history={locationService.getHistory()}>
      <Provider store={store}>
        <GrafanaContext.Provider value={getGrafanaContextMock()}>
          <Route path="/a/:pluginId" exact render={(props) => <GrafanaRoute {...props} route={route} />} />
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

  it('should not render component if not at plugin path', async () => {
    getPluginSettingsMock.mockResolvedValue(pluginMeta);

    const plugin = new AppPlugin();
    plugin.meta = pluginMeta;
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    renderUnderRouter();

    expect(await screen.findByText('my great component')).toBeVisible();

    // renders the first time
    expect(RootComponent.timesRendered).toEqual(1);

    await act(async () => {
      locationService.push('/foo');
    });

    expect(RootComponent.timesRendered).toEqual(1);

    await act(async () => {
      locationService.push('/a/my-awesome-plugin');
    });

    expect(RootComponent.timesRendered).toEqual(2);
  });
});
