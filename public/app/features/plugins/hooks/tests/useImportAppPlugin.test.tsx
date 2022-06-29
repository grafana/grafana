import { render, act, waitFor } from '@testing-library/react';
import React from 'react';

import { AppPlugin, PluginType } from '@grafana/data';

import { getMockPlugin } from '../../__mocks__/pluginMocks';
import { getPluginSettings } from '../../pluginSettings';
import { importAppPlugin } from '../../plugin_loader';
import { useImportAppPlugin } from '../useImportAppPlugin';

jest.mock('../../pluginSettings', () => ({
  getPluginSettings: jest.fn(),
}));
jest.mock('../../plugin_loader', () => ({
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

const PLUGIN_ID = 'sample-plugin';

describe('useImportAppPlugin()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('returns the imported plugin in case it exists', async () => {
    let response: any;
    getPluginSettingsMock.mockResolvedValue(getAppPluginMeta());
    importAppPluginMock.mockResolvedValue(getAppPluginMock());

    act(() => {
      response = runHook(PLUGIN_ID);
    });

    await waitFor(() => expect(response.value).not.toBeUndefined());
    await waitFor(() => expect(response.error).toBeUndefined());
    await waitFor(() => expect(response.loading).toBe(false));
  });

  test('returns an error if the plugin does not exist', async () => {
    let response: any;

    act(() => {
      response = runHook(PLUGIN_ID);
    });

    await waitFor(() => expect(response.value).toBeUndefined());
    await waitFor(() => expect(response.error).not.toBeUndefined());
    await waitFor(() => expect(response.error.message).toMatch(/unknown plugin/i));
    await waitFor(() => expect(response.loading).toBe(false));
  });

  test('returns an error if the plugin is not an app', async () => {
    let response: any;
    getPluginSettingsMock.mockResolvedValue(getAppPluginMeta({ type: PluginType.panel }));
    importAppPluginMock.mockResolvedValue(getAppPluginMock());

    act(() => {
      response = runHook(PLUGIN_ID);
    });

    await waitFor(() => expect(response.value).toBeUndefined());
    await waitFor(() => expect(response.error).not.toBeUndefined());
    await waitFor(() => expect(response.error.message).toMatch(/plugin must be an app/i));
    await waitFor(() => expect(response.loading).toBe(false));
  });

  test('returns an error if the plugin is not enabled', async () => {
    let response: any;
    getPluginSettingsMock.mockResolvedValue(getAppPluginMeta({ enabled: false }));
    importAppPluginMock.mockResolvedValue(getAppPluginMock());

    act(() => {
      response = runHook(PLUGIN_ID);
    });

    await waitFor(() => expect(response.value).toBeUndefined());
    await waitFor(() => expect(response.error).not.toBeUndefined());
    await waitFor(() => expect(response.error.message).toMatch(/is not enabled/i));
    await waitFor(() => expect(response.loading).toBe(false));
  });

  test('returns errors that happen during fetching plugin settings', async () => {
    let response: any;
    const errorMsg = 'Error while fetching plugin data';
    getPluginSettingsMock.mockRejectedValue(new Error(errorMsg));
    importAppPluginMock.mockResolvedValue(getAppPluginMock());

    act(() => {
      response = runHook(PLUGIN_ID);
    });

    await waitFor(() => expect(response.value).toBeUndefined());
    await waitFor(() => expect(response.error).not.toBeUndefined());
    await waitFor(() => expect(response.error.message).toBe(errorMsg));
    await waitFor(() => expect(response.loading).toBe(false));
  });

  test('returns errors that happen during importing a plugin', async () => {
    let response: any;
    const errorMsg = 'Error while importing the plugin';
    getPluginSettingsMock.mockResolvedValue(getAppPluginMeta());
    importAppPluginMock.mockRejectedValue(new Error(errorMsg));

    act(() => {
      response = runHook(PLUGIN_ID);
    });

    await waitFor(() => expect(response.value).toBeUndefined());
    await waitFor(() => expect(response.error).not.toBeUndefined());
    await waitFor(() => expect(response.error.message).toBe(errorMsg));
    await waitFor(() => expect(response.loading).toBe(false));
  });
});

function runHook(id: string): any {
  const returnVal = {};
  function TestComponent() {
    Object.assign(returnVal, useImportAppPlugin(id));
    return null;
  }
  render(<TestComponent />);
  return returnVal;
}

function getAppPluginMeta(overrides?: Record<string, any>) {
  return getMockPlugin({
    id: PLUGIN_ID,
    type: PluginType.app,
    enabled: true,
    ...overrides,
  });
}

function getAppPluginMock() {
  const plugin = new AppPlugin();

  plugin.init(getAppPluginMeta());

  return plugin;
}
