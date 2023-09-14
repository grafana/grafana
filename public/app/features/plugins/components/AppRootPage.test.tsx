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

async function renderUnderRouter(page = '') {
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

  const pagePath = page ? `/${page}` : '';
  const store = configureStore();
  const route = {
    component: () => <AppRootPage pluginId="my-awesome-plugin" pluginNavSection={appsSection} />,
  } as unknown as RouteDescriptor;

  await act(async () => {
    locationService.push(`/a/my-awesome-plugin${pagePath}`);
  });

  render(
    <Router history={locationService.getHistory()}>
      <Provider store={store}>
        <GrafanaContext.Provider value={getGrafanaContextMock()}>
          <Route path={`/a/:pluginId${pagePath}`} exact render={(props) => <GrafanaRoute {...props} route={route} />} />
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

  it('should not render the component if we are not under a plugin path', async () => {
    getPluginSettingsMock.mockResolvedValue(pluginMeta);

    const plugin = new AppPlugin();
    plugin.meta = pluginMeta;
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    // Renders once for the first time
    await renderUnderRouter();
    expect(await screen.findByText('my great component')).toBeVisible();
    expect(RootComponent.timesRendered).toEqual(1);

    // Does not render again when navigating to a non-plugin path
    await act(async () => {
      locationService.push('/foo');
    });
    expect(RootComponent.timesRendered).toEqual(1);

    // Renders it again when navigating back to a plugin path
    await act(async () => {
      locationService.push('/a/my-awesome-plugin');
    });
    expect(RootComponent.timesRendered).toEqual(2);
  });

  describe('When accessing using different roles', () => {
    beforeEach(() => {
      const pluginMetaWithIncludes = getMockPlugin({
        id: 'my-awesome-plugin',
        type: PluginType.app,
        enabled: true,
        includes: [
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 1',
            path: '/a/my-awesome-plugin/viewer-page',
            role: 'Viewer',
          },
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 2',
            path: '/a/my-awesome-plugin/editor-page',
            role: 'Editor',
          },
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 2',
            path: '/a/my-awesome-plugin/admin-page',
            role: 'Admin',
          },
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 2',
            path: '/a/my-awesome-plugin/page-without-role',
          },
        ],
      });

      getPluginSettingsMock.mockResolvedValue(pluginMetaWithIncludes);

      const plugin = new AppPlugin();
      plugin.meta = pluginMetaWithIncludes;
      plugin.root = RootComponent;

      importAppPluginMock.mockResolvedValue(plugin);
    });

    it('a Viewer should only have access to pages with "Viewer" roles', async () => {
      contextSrv.user.orgRole = OrgRole.Viewer;

      // Viewer has access to a plugin entry page by default
      await renderUnderRouter('');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Viewer has access to a page without roles
      await renderUnderRouter('page-without-role');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Viewer has access to Viewer page
      await renderUnderRouter('viewer-page');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Viewer does not have access to Editor page
      await renderUnderRouter('editor-page');
      expect(await screen.findByText('Access denied')).toBeVisible();

      // Viewer does not have access to a Admin page
      await renderUnderRouter('admin-page');
      expect(await screen.findByText('Access denied')).toBeVisible();
    });

    it('an Editor should have access to pages with both "Viewer" and "Editor" roles', async () => {
      contextSrv.user.orgRole = OrgRole.Editor;
      contextSrv.isEditor = true;

      // Viewer has access to a plugin entry page by default
      await renderUnderRouter('');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Editor has access to a page without roles
      await renderUnderRouter('page-without-role');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Editor has access to Viewer page
      await renderUnderRouter('viewer-page');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Editor has access to Editor page
      await renderUnderRouter('editor-page');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Editor does not have access to a Admin page
      await renderUnderRouter('admin-page');
      expect(await screen.findByText('Access denied')).toBeVisible();
    });

    it('a Grafana Admin should be able to see any page', async () => {
      contextSrv.isGrafanaAdmin = true;

      // Viewer has access to a plugin entry page
      await renderUnderRouter('');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Admin has access to a page without roles
      await renderUnderRouter('page-without-role');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Admin has access to Viewer page
      await renderUnderRouter('viewer-page');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Admin has access to Editor page
      await renderUnderRouter('editor-page');
      expect(await screen.findByText('my great component')).toBeVisible();

      // Admin has access to a Admin page
      await renderUnderRouter('admin-page');
      expect(await screen.findByText('my great component')).toBeVisible();
    });
  });
});
