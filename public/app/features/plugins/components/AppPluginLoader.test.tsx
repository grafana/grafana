import { render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { Router } from 'react-router-dom';

import { AppPlugin, PluginType, AppRootProps, NavModelItem } from '@grafana/data';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { Echo } from 'app/core/services/echo/Echo';

import { getMockPlugin } from '../__mocks__/pluginMocks';
import { useImportAppPlugin } from '../hooks/useImportAppPlugin';

import { AppPluginLoader } from './AppPluginLoader';

jest.mock('../hooks/useImportAppPlugin', () => ({
  useImportAppPlugin: jest.fn(),
}));

const useImportAppPluginMock = useImportAppPlugin as jest.Mock<
  ReturnType<typeof useImportAppPlugin>,
  Parameters<typeof useImportAppPlugin>
>;

const TEXTS = {
  PLUGIN_TITLE: 'Amazing App',
  PLUGIN_CONTENT: 'This is my amazing app plugin!',
  PLUGIN_TAB_TITLE_A: 'Tab (A)',
  PLUGIN_TAB_TITLE_B: 'Tab (B)',
};

describe('AppPluginLoader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    AppPluginComponent.timesMounted = 0;
    setEchoSrv(new Echo());
  });

  test('renders the app plugin correctly', async () => {
    useImportAppPluginMock.mockReturnValue({ value: getAppPluginMock(), loading: false, error: undefined });

    renderAppPlugin();

    expect(await screen.findByText(TEXTS.PLUGIN_TITLE)).toBeVisible();
    expect(await screen.findByText(TEXTS.PLUGIN_CONTENT)).toBeVisible();
    expect(await screen.findByLabelText(`Tab ${TEXTS.PLUGIN_TAB_TITLE_A}`)).toBeVisible();
    expect(await screen.findByLabelText(`Tab ${TEXTS.PLUGIN_TAB_TITLE_B}`)).toBeVisible();
    expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
  });

  test('renders the app plugin only once', async () => {
    useImportAppPluginMock.mockReturnValue({ value: getAppPluginMock(), loading: false, error: undefined });

    renderAppPlugin();

    expect(await screen.findByText(TEXTS.PLUGIN_TITLE)).toBeVisible();
    expect(AppPluginComponent.timesMounted).toEqual(1);
  });

  test('renders a loader while the plugin is loading', async () => {
    useImportAppPluginMock.mockReturnValue({ value: undefined, loading: true, error: undefined });

    renderAppPlugin();

    expect(await screen.findByText('Loading ...')).toBeVisible();
    expect(screen.queryByText(TEXTS.PLUGIN_TITLE)).not.toBeInTheDocument();
  });

  test('renders an error message if there are any errors while importing the plugin', async () => {
    const errorMsg = 'Unable to find plugin';
    useImportAppPluginMock.mockReturnValue({ value: undefined, loading: false, error: new Error(errorMsg) });

    renderAppPlugin();

    expect(await screen.findByText(errorMsg)).toBeVisible();
    expect(screen.queryByText(TEXTS.PLUGIN_TITLE)).not.toBeInTheDocument();
  });
});

function renderAppPlugin() {
  render(
    <Router history={locationService.getHistory()}>
      <AppPluginLoader id="foo" />;
    </Router>
  );
}
class AppPluginComponent extends Component<AppRootProps> {
  static timesMounted = 0;

  componentDidMount() {
    AppPluginComponent.timesMounted += 1;

    const node: NavModelItem = {
      text: TEXTS.PLUGIN_TITLE,
      children: [
        {
          text: TEXTS.PLUGIN_TAB_TITLE_A,
          url: '/tab-a',
          id: 'a',
        },
        {
          text: TEXTS.PLUGIN_TAB_TITLE_B,
          url: '/tab-b',
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
    return <p>{TEXTS.PLUGIN_CONTENT}</p>;
  }
}

function getAppPluginMeta() {
  return getMockPlugin({
    type: PluginType.app,
    enabled: true,
  });
}

function getAppPluginMock() {
  const plugin = new AppPlugin();

  plugin.root = AppPluginComponent;
  plugin.init(getAppPluginMeta());

  return plugin;
}
