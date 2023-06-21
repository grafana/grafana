import { isFunction } from 'lodash';
import React, { ComponentType, FC } from 'react';

import { PluginConfigPage, PluginExtensionConfig, PluginMeta } from '@grafana/data';

import { SandboxedPluginObject } from './types';
import { isSandboxedPluginObject } from './utils';

/**
 * Plugins must render their components inside a div with a `data-plugin-sandbox` attribute
 * that has their pluginId as value.
 * If they don't they won't work as expected because they won't be able to get DOM elements
 * This affect all type of plugins.
 *
 * One could say this wrapping should occur inside the Panel,Datasource and App clases inside `@grafana/*`
 * packages like `@grafana/data` but this is not the case. Even though this code is less future-proof than
 * putting it there we have the following cases to cover:
 *
 * - plugins could start bundling grafana dependencies: thus not getting updates on sandboxing code or worse,
 *   modifying the code to escape the sandbox
 * - we leak sandboxing code outside of the sandbox configuration. This mean some sandboxing leftover could be
 *   left in non-sandboxed code (e.g. sandbox wrappers showing up even if sandbox is disabled)
 *
 * The biggest con is that we must maintain this code to keep it up to date with possible additional components and
 * classes that plugins could bring.
 *
 */
export async function sandboxPluginComponents(
  pluginExports: unknown,
  meta: PluginMeta
): Promise<SandboxedPluginObject | unknown> {
  if (!isSandboxedPluginObject(pluginExports)) {
    // we should monitor these cases. There should not be any plugins without a plugin export loaded inside the sandbox
    return pluginExports;
  }

  const pluginObject = await Promise.resolve(pluginExports.plugin);

  // intentionally not early exit to cover possible future cases

  // wrap panel component
  if (Reflect.has(pluginObject, 'panel')) {
    Reflect.set(pluginObject, 'panel', withSandboxWrapper(Reflect.get(pluginObject, 'panel'), meta.id));
  }

  // wrap datasource components
  if (Reflect.has(pluginObject, 'components')) {
    const components: Record<string, ComponentType> = Reflect.get(pluginObject, 'components');
    Object.entries(components).forEach(([key, value]) => {
      Reflect.set(components, key, withSandboxWrapper(value, meta.id));
    });
    Reflect.set(pluginObject, 'components', components);
  }

  // wrap app components
  if (Reflect.has(pluginObject, 'root')) {
    Reflect.set(pluginObject, 'root', withSandboxWrapper(Reflect.get(pluginObject, 'root'), meta.id));
  }

  // extension components
  if (Reflect.has(pluginObject, 'extensionConfigs')) {
    const extensions: PluginExtensionConfig[] = Reflect.get(pluginObject, 'extensionConfigs');
    for (const extension of extensions) {
      if (Reflect.has(extension, 'component')) {
        Reflect.set(extension, 'component', withSandboxWrapper(Reflect.get(extension, 'component'), meta.id));
      }
    }
    Reflect.set(pluginObject, 'extensionConfigs', extensions);
  }

  // config pages
  if (Reflect.has(pluginObject, 'configPages')) {
    const configPages: Record<string, PluginConfigPage<any>> = Reflect.get(pluginObject, 'configPages');
    for (const [key, value] of Object.entries(configPages)) {
      if (!value.body || !isFunction(value.body)) {
        continue;
      }
      Reflect.set(configPages, key, {
        ...value,
        body: withSandboxWrapper(value.body, meta.id),
      });
    }
    Reflect.set(pluginObject, 'configPages', configPages);
  }

  return pluginExports;
}

const withSandboxWrapper = <P extends object>(
  WrappedComponent: ComponentType<P>,
  pluginId: string
): React.MemoExoticComponent<FC<P>> => {
  const WithWrapper = React.memo((props: P) => {
    return (
      <div data-plugin-sandbox={pluginId}>
        <WrappedComponent {...props} />
      </div>
    );
  });
  WithWrapper.displayName = `GrafanaSandbox(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithWrapper;
};
