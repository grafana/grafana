import { configureStore } from '@reduxjs/toolkit';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

import { installPlugin, uninstallPlugin } from '../api';

import { install, uninstall } from './actions';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  installPlugin: jest.fn(),
  uninstallPlugin: jest.fn(),
}));

const installPluginMock = jest.mocked(installPlugin);
const uninstallPluginMock = jest.mocked(uninstallPlugin);

function setup() {
  return configureStore({ reducer: (state = {}) => state });
}

describe('install thunk', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject with the id and message when the install fails with a plain error', async () => {
    installPluginMock.mockRejectedValue(
      new Error('Failed to install plugin myorg-test-panel 500:Internal Server Error')
    );

    const result = await setup().dispatch(install({ id: 'myorg-test-panel', version: '1.5.0' }));

    expect(result.payload).toEqual({
      id: 'myorg-test-panel',
      message: 'Failed to install plugin myorg-test-panel 500:Internal Server Error',
    });
  });

  it('should reject with a generic message when the failure is not an error', async () => {
    installPluginMock.mockRejectedValue('nope');

    const result = await setup().dispatch(install({ id: 'myorg-test-panel', version: '1.5.0' }));

    expect(result.payload).toBe('Unknown error.');
  });
});

describe('uninstall thunk', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(appEvents, 'emit');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show an error alert when the uninstall fails with a plain error', async () => {
    uninstallPluginMock.mockRejectedValue(
      new Error('Failed to uninstall plugin myorg-test-panel 500:Internal Server Error')
    );

    const result = await setup().dispatch(uninstall('myorg-test-panel'));

    expect(result.payload).toBe('Unknown error.');
    expect(appEvents.emit).toHaveBeenCalledWith(AppEvents.alertError, [
      'Failed to uninstall plugin myorg-test-panel 500:Internal Server Error',
    ]);
  });

  it('should not add a second alert when the failure is a FetchError', async () => {
    uninstallPluginMock.mockRejectedValue({ status: 500, data: { message: 'boom' } });

    const result = await setup().dispatch(uninstall('myorg-test-panel'));

    expect(result.payload).toBe('Unknown error.');
    expect(appEvents.emit).not.toHaveBeenCalled();
  });
});
