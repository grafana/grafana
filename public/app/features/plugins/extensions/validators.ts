import type { PluginExtensionAddedLinkConfig, PluginExtension, PluginExtensionLink } from '@grafana/data';
import { PluginAddedLinksConfigureFunc, PluginExtensionPoints } from '@grafana/data/src/types/pluginExtensions';
import { isPluginExtensionLink } from '@grafana/runtime';

export function assertPluginExtensionLink(
  extension: PluginExtension | undefined,
  errorMessage = 'extension is not a link extension'
): asserts extension is PluginExtensionLink {
  if (!isPluginExtensionLink(extension)) {
    throw new Error(errorMessage);
  }
}

export function assertLinkPathIsValid(pluginId: string, path: string) {
  if (!isLinkPathValid(pluginId, path)) {
    throw new Error(
      `Invalid link extension. The "path" is required and should start with "/a/${pluginId}/" (currently: "${path}"). Skipping the extension.`
    );
  }
}

export function assertIsReactComponent(component: React.ComponentType) {
  if (!isReactComponent(component)) {
    throw new Error(`Invalid component extension, the "component" property needs to be a valid React component.`);
  }
}

export function assertConfigureIsValid(config: PluginExtensionAddedLinkConfig) {
  if (!isConfigureFnValid(config.configure)) {
    throw new Error(
      `Invalid extension "${config.title}". The "configure" property must be a function. Skipping the extension.`
    );
  }
}

export function assertStringProps(extension: Record<string, unknown>, props: string[]) {
  for (const prop of props) {
    if (!isStringPropValid(extension[prop])) {
      throw new Error(
        `Invalid extension "${extension.title}". Property "${prop}" must be a string and cannot be empty. Skipping the extension.`
      );
    }
  }
}

export function assertIsNotPromise(value: unknown, errorMessage = 'The provided value is a Promise.'): void {
  if (isPromise(value)) {
    throw new Error(errorMessage);
  }
}

export function isLinkPathValid(pluginId: string, path: string) {
  return Boolean(typeof path === 'string' && path.length > 0 && path.startsWith(`/a/${pluginId}/`));
}

export function isExtensionPointIdValid({
  extensionPointId,
  pluginId,
}: {
  extensionPointId: string;
  pluginId: string;
}) {
  if (extensionPointId.startsWith('grafana/')) {
    return true;
  }

  return Boolean(extensionPointId.startsWith(`plugins/${pluginId}/`) || extensionPointId.startsWith(`${pluginId}/`));
}

export function extensionPointEndsWithVersion(extensionPointId: string) {
  return extensionPointId.match(/.*\/v\d+$/);
}

export function isGrafanaCoreExtensionPoint(extensionPointId: string) {
  return Object.values(PluginExtensionPoints)
    .map((v) => v.toString())
    .includes(extensionPointId);
}

export function isConfigureFnValid(configure?: PluginAddedLinksConfigureFunc<object> | undefined) {
  return configure ? typeof configure === 'function' : true;
}

export function isStringPropValid(prop: unknown) {
  return typeof prop === 'string' && prop.length > 0;
}

export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value instanceof Promise || (typeof value === 'object' && value !== null && 'then' in value && 'catch' in value)
  );
}

export function isReactComponent(component: unknown): component is React.ComponentType {
  const hasReactTypeProp = (obj: unknown): obj is { $$typeof: Symbol } =>
    typeof obj === 'object' && obj !== null && '$$typeof' in obj;

  // The sandbox wraps the plugin components with React.memo.
  const isReactMemoObject = (obj: unknown): boolean =>
    hasReactTypeProp(obj) && obj.$$typeof === Symbol.for('react.memo');

  // We currently don't have any strict runtime-checking for this.
  // (The main reason is that we don't want to start depending on React implementation details.)
  return typeof component === 'function' || isReactMemoObject(component);
}
