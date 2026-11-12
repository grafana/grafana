import { configureStore } from '@reduxjs/toolkit';

import { installPlugin } from '../api';

import { install } from './actions';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  installPlugin: jest.fn(),
}));

const installPluginMock = jest.mocked(installPlugin);

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
