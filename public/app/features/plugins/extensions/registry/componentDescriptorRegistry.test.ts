import { isAppPluginEnabled } from '@grafana/runtime';
import { clearAppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';

import { genericAppPluginConfig } from '../test-fixtures/config.apps';

import { loadComponentDescriptorRegistry } from './componentDescriptorRegistry';

jest.mock('@grafana/runtime', () => ({ ...jest.requireActual('@grafana/runtime'), isAppPluginEnabled: jest.fn() }));

afterEach(clearAppPluginMetas);

it('should list only valid descriptors owned by enabled apps', async () => {
  const discovery = { version: 'v1', datasource: 'loki', prompt: 'Show logs' };
  const component = { id: 'enabled-app/logs/v1', title: 'Logs', discovery };
  setAppPluginMetas({
    'enabled-app': {
      ...genericAppPluginConfig,
      id: 'enabled-app',
      extensions: {
        ...genericAppPluginConfig.extensions,
        exposedComponents: [
          component,
          { ...component, id: 'foreign-app/logs/v1' },
          { ...component, id: 'enabled-app/invalid/v1', discovery: { ...discovery, props: { type: 'invalid' } } },
          { ...component, id: 'enabled-app/future/v1', discovery: { ...discovery, version: 'v2' } },
        ],
      },
    },
    'disabled-app': {
      ...genericAppPluginConfig,
      id: 'disabled-app',
      extensions: {
        ...genericAppPluginConfig.extensions,
        exposedComponents: [{ ...component, id: 'disabled-app/logs/v1' }],
      },
    },
  });
  jest.mocked(isAppPluginEnabled).mockImplementation(async (id) => id === 'enabled-app');

  const registry = await loadComponentDescriptorRegistry();

  expect(registry.list('loki').map(({ id }) => id)).toEqual(['enabled-app/logs/v1']);
  expect(registry.get('disabled-app/logs/v1')).toBeUndefined();
});
