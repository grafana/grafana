import { renderHook, waitFor } from '@testing-library/react';

import { isAppPluginEnabled } from '@grafana/runtime';
import { clearAppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';

import { ComponentDescriptorsProvider } from './ComponentDescriptorsContext';
import { genericAppPluginConfig } from './test-fixtures/config.apps';
import { useRegisterComponentHostAdapter } from './useRegisterComponentHostAdapter';

jest.mock('@grafana/runtime', () => ({ ...jest.requireActual('@grafana/runtime'), isAppPluginEnabled: jest.fn() }));

afterEach(clearAppPluginMetas);

it('should register matching descriptors and dispose each registration when its host unmounts', async () => {
  setAppPluginMetas({
    'example-app': {
      ...genericAppPluginConfig,
      id: 'example-app',
      extensions: {
        ...genericAppPluginConfig.extensions,
        exposedComponents: [
          {
            id: 'example-app/preview/v1',
            title: 'Preview',
            discovery: { version: 'v1', datasource: 'example-source', prompt: 'Preview data' },
          },
        ],
      },
    },
  });
  jest.mocked(isAppPluginEnabled).mockResolvedValue(true);
  const firstDispose = jest.fn();
  const secondDispose = jest.fn();
  const first = { supports: () => true, register: jest.fn(() => firstDispose) };
  const second = { supports: () => true, register: jest.fn(() => secondDispose) };
  const skipped = { supports: () => false, register: jest.fn(() => jest.fn()) };

  const { rerender, unmount } = renderHook(({ host }) => useRegisterComponentHostAdapter(host), {
    initialProps: { host: first },
    wrapper: ComponentDescriptorsProvider,
  });
  await waitFor(() => expect(first.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'example-app/preview/v1' })));
  rerender({ host: skipped });
  expect(firstDispose).toHaveBeenCalledTimes(1);
  expect(skipped.register).not.toHaveBeenCalled();

  rerender({ host: second });
  expect(second.register).toHaveBeenCalledTimes(1);
  expect(secondDispose).not.toHaveBeenCalled();
  unmount();
  expect(secondDispose).toHaveBeenCalledTimes(1);
});
