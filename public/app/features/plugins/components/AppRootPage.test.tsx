import { act, screen } from '@testing-library/react';
import { Component } from 'react';
import { Routes, Route, Link } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import { AppPlugin, PluginType, AppRootProps, NavModelItem, PluginIncludeType, OrgRole } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test';
import { setEchoSrv } from '@grafana/runtime';
import { GrafanaRouteWrapper } from 'app/core/navigation/GrafanaRoute';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';

import { ExtensionRegistriesProvider } from '../extensions/ExtensionRegistriesContext';
import { AddedComponentsRegistry } from '../extensions/registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from '../extensions/registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from '../extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from '../extensions/registry/ExposedComponentsRegistry';
import { UrlRecognizersRegistry } from '../extensions/registry/UrlRecognizersRegistry';
import { importAppPlugin } from '../pluginLoader';
import { getPluginSettings } from '../pluginSettings';

import AppRootPage from './AppRootPage';

jest.mock('../pluginSettings', () => ({
  getPluginSettings: jest.fn(),
}));
jest.mock('../pluginLoader', () => ({
  importAppPlugin: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {},
    apps: {},
    theme2: {
      breakpoints: {
        values: {
          sm: 576,
          md: 768,
          lg: 992,
          xl: 1200,
        },
      },
    },
  },
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

  const registries = {
    addedComponentsRegistry: new AddedComponentsRegistry(),
    exposedComponentsRegistry: new ExposedComponentsRegistry(),
    addedLinksRegistry: new AddedLinksRegistry(),
    addedFunctionsRegistry: new AddedFunctionsRegistry(),
    urlRecognizersRegistry: new UrlRecognizersRegistry(),
  };
  const pagePath = page ? `/${page}` : '';
  const route = {
    path: `/a/:pluginId/*`,
    component: () => <AppRootPage pluginId="my-awesome-plugin" pluginNavSection={appsSection} />,
  };

  const Foo = () => {
    return <Link to={`/a/my-awesome-plugin${pagePath}`}>Navigate</Link>;
  };

  return render(
    <ExtensionRegistriesProvider registries={registries}>
      <Routes>
        <Route
          path={route.path}
          element={
            <>
              <GrafanaRouteWrapper route={route} />
              {/* Add Link to trigger navigation instead of using locationService */}
              <Link to={'/foo'}>Navigate</Link>
            </>
          }
        />
        <Route path={'/foo'} element={<Foo />} />
      </Routes>
    </ExtensionRegistriesProvider>,
    {
      historyOptions: {
        initialEntries: [`/a/my-awesome-plugin${pagePath}`],
      },
    }
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

  it("should show a not found page if the plugin settings can't load", async () => {
    jest.spyOn(console, 'error').mockImplementation();
    getPluginSettingsMock.mockRejectedValue(new Error('Unknown Plugin'));
    // Renders once for the first time
    renderUnderRouter();
    expect(await screen.findByText('App not found')).toBeVisible();
  });

  it('should not render the component if we are not under a plugin path', async () => {
    getPluginSettingsMock.mockResolvedValue(pluginMeta);

    const plugin = new AppPlugin();
    plugin.meta = pluginMeta;
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    // Renders once for the first time
    renderUnderRouter();
    expect(await screen.findByText('my great component')).toBeVisible();
    expect(RootComponent.timesRendered).toEqual(1);

    // Does not render again when navigating to a non-plugin path
    await act(async () => {
      screen.getByRole('link', { name: 'Navigate' }).click();
    });
    expect(RootComponent.timesRendered).toEqual(1);

    // Renders it again when navigating back to a plugin path
    await act(async () => {
      screen.getByRole('link', { name: 'Navigate' }).click();
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
            name: 'Awesome page with mistake',
            path: '/a/my-awesome-plugin/mistake-page',
            role: 'NotExistingRole',
          },
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 2',
            path: '/a/my-awesome-plugin/page-without-role',
          },
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 3',
            path: '/a/my-awesome-plugin/page-with-action-no-role',
            action: 'grafana-awesomeapp.user-settings:read',
          },
          {
            type: PluginIncludeType.page,
            name: 'Awesome page 4',
            path: '/a/my-awesome-plugin/page-with-action-and-role',
            role: 'Viewer',
            action: 'grafana-awesomeapp.user-settings:read',
          },
        ],
      });

      getPluginSettingsMock.mockResolvedValue(pluginMetaWithIncludes);

      const plugin = new AppPlugin();
      plugin.meta = pluginMetaWithIncludes;
      plugin.root = RootComponent;

      importAppPluginMock.mockResolvedValue(plugin);
    });

    it('an User should not be able to see page with not existing role', async () => {
      contextSrv.user.orgRole = OrgRole.Editor;

      renderUnderRouter('mistake-page');
      expect(await screen.findByText('Access denied')).toBeVisible();
    });

    describe('Plugin page access control', () => {
      beforeEach(() => {
        // Reset context and permissions before each test
        contextSrv.user.orgRole = OrgRole.None;
        contextSrv.user.permissions = {};
        contextSrv.isEditor = false;
        contextSrv.isGrafanaAdmin = false;
      });

      it('should allow access to plugin entry page by default', async () => {
        renderUnderRouter('');
        expect(await screen.findByText('my great component')).toBeVisible();
      });

      it('should deny access to page with action but no role when user has no permissions', async () => {
        renderUnderRouter('page-with-action-no-role');
        expect(await screen.findByText('Access denied')).toBeVisible();
      });

      it('should deny access to page with action and role when user has no permissions', async () => {
        renderUnderRouter('page-with-action-and-role');
        expect(await screen.findByText('Access denied')).toBeVisible();
      });

      it('should allow access to page without roles', async () => {
        renderUnderRouter('page-without-role');
        expect(await screen.findByText('my great component')).toBeVisible();
      });

      it('should deny access to viewer page when user has no permissions', async () => {
        renderUnderRouter('viewer-page');
        expect(await screen.findByText('Access denied')).toBeVisible();
      });

      describe('with user permissions', () => {
        beforeEach(() => {
          contextSrv.user.permissions = {
            'grafana-awesomeapp.user-settings:read': true,
          };
        });

        it('should allow access to page with action but no role when user has permissions', async () => {
          renderUnderRouter('page-with-action-no-role');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should allow access to page with action and role when user has permissions', async () => {
          renderUnderRouter('page-with-action-and-role');
          expect(await screen.findByText('my great component')).toBeVisible();
        });
      });
      describe('Viewer role access', () => {
        beforeEach(() => {
          contextSrv.user.orgRole = OrgRole.Viewer;
        });

        it('should allow access to plugin entry page', async () => {
          renderUnderRouter('');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should deny access to page with action but no role', async () => {
          renderUnderRouter('page-with-action-no-role');
          expect(await screen.findByText('Access denied')).toBeVisible();
        });

        it('should deny access to page with action and role', async () => {
          renderUnderRouter('page-with-action-and-role');
          expect(await screen.findByText('Access denied')).toBeVisible();
        });

        it('should allow access to page without roles', async () => {
          renderUnderRouter('page-without-role');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should allow access to viewer page', async () => {
          renderUnderRouter('viewer-page');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should deny access to editor page', async () => {
          renderUnderRouter('editor-page');
          expect(await screen.findByText('Access denied')).toBeVisible();
        });

        it('should deny access to admin page', async () => {
          renderUnderRouter('admin-page');
          expect(await screen.findByText('Access denied')).toBeVisible();
        });
      });
      describe('Editor role access', () => {
        beforeEach(() => {
          contextSrv.user.orgRole = OrgRole.Editor;
          contextSrv.isEditor = true;
        });

        describe('without permissions', () => {
          it('should deny access to pages with actions', async () => {
            renderUnderRouter('page-with-action-no-role');
            expect(await screen.findByText('Access denied')).toBeVisible();

            renderUnderRouter('page-with-action-and-role');
            expect(await screen.findByText('Access denied')).toBeVisible();
          });

          it('should allow access to basic pages', async () => {
            renderUnderRouter('');
            expect(await screen.findByText('my great component')).toBeVisible();

            renderUnderRouter('page-without-role');
            expect(await screen.findByText('my great component')).toBeVisible();
          });

          it('should allow access to viewer and editor pages', async () => {
            renderUnderRouter('viewer-page');
            expect(await screen.findByText('my great component')).toBeVisible();

            renderUnderRouter('editor-page');
            expect(await screen.findByText('my great component')).toBeVisible();
          });

          it('should deny access to admin page', async () => {
            renderUnderRouter('admin-page');
            expect(await screen.findByText('Access denied')).toBeVisible();
          });
        });

        describe('with permissions', () => {
          beforeEach(() => {
            contextSrv.user.permissions = {
              'grafana-awesomeapp.user-settings:read': true,
            };
          });

          it('should allow access to pages with actions', async () => {
            renderUnderRouter('page-with-action-no-role');
            expect(await screen.findByText('my great component')).toBeVisible();

            renderUnderRouter('page-with-action-and-role');
            expect(await screen.findByText('my great component')).toBeVisible();
          });
        });
      });

      describe('Admin role access', () => {
        beforeEach(() => {
          contextSrv.user.orgRole = OrgRole.Admin;
        });

        describe('without permissions', () => {
          it('should deny access to pages with actions', async () => {
            renderUnderRouter('page-with-action-no-role');
            expect(await screen.findByText('Access denied')).toBeVisible();

            renderUnderRouter('page-with-action-and-role');
            expect(await screen.findByText('Access denied')).toBeVisible();
          });

          it('should allow access to plugin entry page', async () => {
            renderUnderRouter('');
            expect(await screen.findByText('my great component')).toBeVisible();
          });

          it('should allow access to page without role', async () => {
            renderUnderRouter('page-without-role');
            expect(await screen.findByText('my great component')).toBeVisible();
          });

          it('should allow access to viewer page', async () => {
            renderUnderRouter('viewer-page');
            expect(await screen.findByText('my great component')).toBeVisible();
          });

          it('should allow access to editor page', async () => {
            renderUnderRouter('editor-page');
            expect(await screen.findByText('my great component')).toBeVisible();
          });

          it('should allow access to admin page', async () => {
            renderUnderRouter('admin-page');
            expect(await screen.findByText('my great component')).toBeVisible();
          });
        });
      });

      describe('Grafana Admin access', () => {
        beforeEach(() => {
          contextSrv.isGrafanaAdmin = true;
        });

        it('should deny access to pages with actions', async () => {
          renderUnderRouter('page-with-action-no-role');
          expect(await screen.findByText('Access denied')).toBeVisible();

          renderUnderRouter('page-with-action-and-role');
          expect(await screen.findByText('Access denied')).toBeVisible();
        });

        it('should allow access to plugin entry page', async () => {
          renderUnderRouter('');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should allow access to page without role', async () => {
          renderUnderRouter('page-without-role');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should allow access to viewer page', async () => {
          renderUnderRouter('viewer-page');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should allow access to editor page', async () => {
          renderUnderRouter('editor-page');
          expect(await screen.findByText('my great component')).toBeVisible();
        });

        it('should allow access to admin page', async () => {
          renderUnderRouter('admin-page');
          expect(await screen.findByText('my great component')).toBeVisible();
        });
      });
    });
  });
});
