import { act, render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { AppPlugin, PluginType, AppRootProps, NavModelItem, PluginIncludeType, OrgRole } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { RouteDescriptor } from 'app/core/navigation/types';
import { contextSrv } from 'app/core/services/context_srv';
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

function renderUnderRouter(page = '') {
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
  locationService.push(`/a/my-awesome-plugin/${page}`);

  render(
    <Router history={locationService.getHistory()}>
      <Provider store={store}>
        <GrafanaContext.Provider value={getGrafanaContextMock()}>
          <Route path={`/a/:pluginId/${page}`} exact render={(props) => <GrafanaRoute {...props} route={route} />} />
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

  // it('should respect roles for specific plugin page', async () => {
  //   contextSrv.user.orgRole = OrgRole.Viewer;
  //   getPluginSettingsMock.mockResolvedValue(pluginMeta);

  //   const plugin = new AppPlugin();
  //   plugin.meta = pluginMetaWithIncludes;
  //   plugin.root = RootComponent;

  //   importAppPluginMock.mockResolvedValue(plugin);

  //   renderUnderRouter('page-1');
  //   // Viewer has access to Viewer page
  //   expect(await screen.findByText('my great component')).toBeVisible();

  //   renderUnderRouter('page-2');

  //   // Viewer does not have access to Editor page
  //   expect(await screen.findByText('Access denied')).toBeVisible();

  //   contextSrv.user.orgRole = OrgRole.Editor;

  //   await act(async () => {
  //     locationService.push('/a/my-awesome-plugin/page-1');
  //   });

  //   // Editor has access to Viewer page
  //   expect(await screen.findByText('my great component')).toBeVisible();

  //   await act(async () => {
  //     locationService.push('/a/my-awesome-plugin/page-2');
  //   });
  //   // Editor has access to Editor page
  //   expect(await screen.findByText('my great component')).toBeVisible();

  //   contextSrv.isGrafanaAdmin = true;

  //   await act(async () => {
  //     locationService.push('/a/my-awesome-plugin/page-1');
  //   });

  //   // Admin has access to Viewer page
  //   expect(await screen.findByText('my great component')).toBeVisible();

  //   await act(async () => {
  //     locationService.push('/a/my-awesome-plugin/page-2');
  //   });
  //   // Admin has access to Editor page
  //   expect(await screen.findByText('my great component')).toBeVisible();
  // });
});

describe('AppRootPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setEchoSrv(new Echo());

    const pluginMetaWithIncludes = getMockPlugin({
      id: 'my-awesome-plugin',
      type: PluginType.app,
      enabled: true,
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Awesome page 1',
          path: '/a/my-awesome-plugin/page-1',
          role: 'Viewer',
        },
        {
          type: PluginIncludeType.page,
          name: 'Awesome page 2',
          path: '/a/my-awesome-plugin/page-2',
          role: 'Editor',
        },
      ],
    });

    getPluginSettingsMock.mockResolvedValue(pluginMetaWithIncludes);

    const plugin = new AppPlugin();
    plugin.meta = pluginMetaWithIncludes;
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);
  });

  it('should respect roles for specific plugin page', async () => {
    contextSrv.user.orgRole = OrgRole.Viewer;
    // getPluginSettingsMock.mockResolvedValue(pluginMeta);

    // const plugin = new AppPlugin();
    // plugin.meta = pluginMetaWithIncludes;
    // plugin.root = RootComponent;

    // importAppPluginMock.mockResolvedValue(plugin);

    renderUnderRouter('page-1');
    // Viewer has access to Viewer page
    expect(await screen.findByText('my great component')).toBeVisible();

    renderUnderRouter('page-2');

    // Viewer does not have access to Editor page
    expect(await screen.findByText('Access denied')).toBeVisible();
  });

  it('should respect Editor role for specific plugin page', async () => {
    contextSrv.user.orgRole = OrgRole.Editor;

    renderUnderRouter('page-1');

    // Editor has access to Viewer page
    expect(await screen.findByText('my great component')).toBeVisible();

    renderUnderRouter('page-2');
    // Editor has access to Editor page
    expect(await screen.findByText('my great component')).toBeVisible();
  });

  it('should respect Admin role for specific plugin page', async () => {
    contextSrv.isGrafanaAdmin = true;

    renderUnderRouter('page-1');

    // Admin has access to Viewer page
    expect(await screen.findByText('my great component')).toBeVisible();

    renderUnderRouter('page-2');

    // Admin has access to Editor page
    expect(await screen.findByText('my great component')).toBeVisible();
  });
});
