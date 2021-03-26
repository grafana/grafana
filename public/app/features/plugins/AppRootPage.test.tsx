import { act, render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import AppRootPage from './AppRootPage';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin } from './plugin_loader';
import { getMockPlugin } from './__mocks__/pluginMocks';
import { AppPlugin, PluginType, AppRootProps, NavModelItem } from '@grafana/data';
import { Route, Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';

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

function rendeUnderRouter() {
  const route = { component: AppRootPage };
  locationService.push('/a/my-awesome-plugin');

  render(
    <Router history={locationService.getHistory()}>
      <Route path="/a/:pluginId" exact render={(props) => <GrafanaRoute {...props} route={route as any} />} />
    </Router>
  );
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

    rendeUnderRouter();

    // check that plugin and nav links were rendered, and plugin is mounted only once
    await screen.findByText('my great plugin');
    await screen.findAllByRole('link', { name: /A page/ });
    await screen.findAllByRole('link', { name: /Another page/ });
    expect(timesMounted).toEqual(1);
  });

  it('should not render component if not at plugin path', async () => {
    getPluginSettingsMock.mockResolvedValue(
      getMockPlugin({
        type: PluginType.app,
        enabled: true,
      })
    );

    let timesRendered = 0;
    class RootComponent extends Component<AppRootProps> {
      render() {
        timesRendered += 1;
        return <p>my great component</p>;
      }
    }

    const plugin = new AppPlugin();
    plugin.root = RootComponent;

    importAppPluginMock.mockResolvedValue(plugin);

    rendeUnderRouter();

    await screen.findByText('my great component');

    // renders the first time
    expect(timesRendered).toEqual(1);

    await act(async () => {
      locationService.push('/foo');
    });

    expect(timesRendered).toEqual(1);

    await act(async () => {
      locationService.push('/a/my-awesome-plugin');
    });

    expect(timesRendered).toEqual(2);
  });
});
