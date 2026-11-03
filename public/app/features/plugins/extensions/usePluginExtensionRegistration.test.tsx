import { act, renderHook, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { firstValueFrom, Subject } from 'rxjs';

import { getAppPluginMetas, setPluginExtensionRegistrationHook } from '@grafana/runtime/internal';
import { type PluginExtensionRegistrationTarget, usePluginExtensionRegistration } from '@grafana/runtime/unstable';

import { ExtensionRegistriesProvider } from './ExtensionRegistriesContext';
import { clearPluginLoadStates, setPluginLoadState } from './pluginLoadState';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { basicApp } from './test-fixtures/config.apps';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { usePluginExtensionRegistration as useCorePluginExtensionRegistration } from './usePluginExtensionRegistration';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getAppPluginMetas: jest.fn(),
}));
jest.mock('./useLoadAppPlugins');

const pluginId = basicApp.id;
const title = 'Test extension';
const extensionPointId = 'grafana/extension-sidebar/v0-alpha';
const id = `${pluginId}/test/v1`;
const contribution = { title, description: 'Test extension', targets: [extensionPointId] };
const app = {
  ...basicApp,
  extensions: {
    ...basicApp.extensions,
    addedComponents: [contribution],
    addedLinks: [contribution],
    addedFunctions: [contribution],
    exposedComponents: [{ id, title, description: 'Test extension' }],
  },
};

function setup(target: PluginExtensionRegistrationTarget = { kind: 'component', pluginId, extensionPointId, title }) {
  const registries = {
    addedComponentsRegistry: new AddedComponentsRegistry([app]),
    addedLinksRegistry: new AddedLinksRegistry([app]),
    addedFunctionsRegistry: new AddedFunctionsRegistry([app]),
    exposedComponentsRegistry: new ExposedComponentsRegistry([app]),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
  );
  return { ...renderHook(usePluginExtensionRegistration, { wrapper, initialProps: target }), registries };
}

beforeEach(() => {
  jest.clearAllMocks();
  setPluginExtensionRegistrationHook(useCorePluginExtensionRegistration);
  clearPluginLoadStates();
  jest.mocked(getAppPluginMetas).mockResolvedValue([app]);
});

it('waits for metadata without treating it as absence or loading a plugin', async () => {
  const metadata = new Subject<Array<typeof app>>();
  jest.mocked(getAppPluginMetas).mockReturnValue(firstValueFrom(metadata));
  const { result } = setup();
  expect(result.current).toEqual({ status: 'unknown' });
  await act(async () => metadata.next([app]));
  expect(result.current).toEqual({ status: 'declared' });
  expect(useLoadAppPlugins).not.toHaveBeenCalled();
});

it.each(['component', 'link', 'function', 'exposed-component'] as const)(
  'observes declared, loading and accepted registration for a %s without invoking it',
  async (kind) => {
    const target: PluginExtensionRegistrationTarget =
      kind === 'exposed-component' ? { kind, id } : { kind, pluginId, extensionPointId, title };
    const { result, registries } = setup(target);
    await waitFor(() => expect(result.current).toEqual({ status: 'declared' }));
    act(() => setPluginLoadState(pluginId, { status: 'loading' }));
    expect(result.current).toEqual({ status: 'loading' });
    const implementation = jest.fn(() => undefined);
    act(() => {
      switch (kind) {
        case 'component':
          registries.addedComponentsRegistry.register({
            pluginId,
            configs: [{ ...contribution, component: implementation }],
          });
          break;
        case 'link':
          registries.addedLinksRegistry.register({
            pluginId,
            configs: [{ ...contribution, path: `/a/${pluginId}`, configure: implementation }],
          });
          break;
        case 'function':
          registries.addedFunctionsRegistry.register({ pluginId, configs: [{ ...contribution, fn: implementation }] });
          break;
        case 'exposed-component':
          registries.exposedComponentsRegistry.register({
            pluginId,
            configs: [{ id, title, description: 'Test extension', component: implementation }],
          });
      }
    });
    expect(result.current).toEqual({ status: 'ready' });
    expect(implementation).not.toHaveBeenCalled();
    expect(useLoadAppPlugins).not.toHaveBeenCalled();
  }
);

it('does not confuse another contribution at the same extension point with the requested one', async () => {
  const { result, registries } = setup();
  await waitFor(() => expect(result.current).toEqual({ status: 'declared' }));
  act(() =>
    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [{ ...contribution, title: 'Different title', component: () => null }],
    })
  );
  expect(result.current).toEqual({ status: 'declared' });
  act(() => setPluginLoadState(pluginId, { status: 'loaded' }));
  expect(result.current).toEqual({
    status: 'failed',
    error: new Error(`Plugin "${pluginId}" did not register the declared extension "${extensionPointId}".`),
  });
});

it('reports load failure for a declared extension and observes a subsequent load', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current).toEqual({ status: 'declared' }));
  const error = new Error('Chunk failed to load');
  act(() => setPluginLoadState(pluginId, { status: 'failed', error }));
  expect(result.current).toEqual({ status: 'failed', error });
  act(() => setPluginLoadState(pluginId, { status: 'loading' }));
  expect(result.current).toEqual({ status: 'loading' });
});

it('reports metadata failure instead of claiming that the extension is absent', async () => {
  const error = new Error('Metadata unavailable');
  jest.mocked(getAppPluginMetas).mockRejectedValue(error);
  const { result } = setup();
  await waitFor(() => expect(result.current).toEqual({ status: 'failed', error }));
});

it('switches to an absent target without retaining the previous registration', async () => {
  const { result, rerender, registries } = setup();
  await waitFor(() => expect(result.current).toEqual({ status: 'declared' }));
  act(() =>
    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [{ ...contribution, component: () => null }],
    })
  );
  expect(result.current).toEqual({ status: 'ready' });
  rerender({ kind: 'component', pluginId, extensionPointId, title: 'Not declared' });
  expect(result.current).toEqual({ status: 'unknown' });
  await waitFor(() => expect(result.current).toEqual({ status: 'absent' }));
});

it('observes accepted registration even when metadata cannot be read', async () => {
  const error = new Error('Metadata unavailable');
  jest.mocked(getAppPluginMetas).mockRejectedValue(error);
  const { result, registries } = setup();
  await waitFor(() => expect(result.current).toEqual({ status: 'failed', error }));
  act(() =>
    registries.addedComponentsRegistry.register({
      pluginId,
      configs: [{ ...contribution, component: () => null }],
    })
  );
  expect(result.current).toEqual({ status: 'ready' });
});
