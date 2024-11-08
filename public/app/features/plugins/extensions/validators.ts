import type {
  PluginExtensionAddedLinkConfig,
  PluginExtension,
  PluginExtensionLink,
  PluginContextType,
  PluginExtensionAddedComponentConfig,
  PluginExtensionExposedComponentConfig,
} from '@grafana/data';
import { PluginAddedLinksConfigureFunc, PluginExtensionPoints } from '@grafana/data/src/types/pluginExtensions';
import { config, isPluginExtensionLink } from '@grafana/runtime';

import { ExtensionsLog } from './logs/log';

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

// Checks if the meta information is missing from the plugin's plugin.json file
export const isExtensionPointMetaInfoMissing = (extensionPointId: string, pluginContext: PluginContextType) => {
  const extensionPoints = pluginContext.meta?.extensions?.extensionPoints;

  return !extensionPoints || !extensionPoints.some((ep) => ep.id === extensionPointId);
};

// Checks if an exposed component that the plugin is depending on is missing from the `dependencies` in the plugin.json file
export const isExposedComponentDependencyMissing = (id: string, pluginContext: PluginContextType) => {
  const exposedComponentsDependencies = pluginContext.meta?.dependencies?.extensions?.exposedComponents;

  return !exposedComponentsDependencies || !exposedComponentsDependencies.includes(id);
};

export const isAddedLinkMetaInfoMissing = (
  pluginId: string,
  metaInfo: PluginExtensionAddedLinkConfig,
  log: ExtensionsLog
) => {
  const app = config.apps[pluginId];
  const logPrefix = `Added-link "${metaInfo.title}" from "${pluginId}" -`;
  const pluginJsonMetaInfo = app ? app.extensions.addedLinks.find(({ title }) => title === metaInfo.title) : null;

  if (!app) {
    log.error(`Could not register added link extension. Reason: Couldn't find app plugin with plugin id "${pluginId}"`);
    return true;
  }

  if (!pluginJsonMetaInfo) {
    log.error(
      'Could not register added link extension. Reason: The extension was not recorded in the plugin.json. Added link extensions must be listed in the section "extensions.addedLinks[]". Currently, this is only required in development but will be enforced also in production builds in the future.'
    );

    return true;
  }

  const targets = Array.isArray(metaInfo.targets) ? metaInfo.targets : [metaInfo.targets];
  if (!targets.every((target) => pluginJsonMetaInfo.targets.includes(target))) {
    log.error(
      'Could not register added link extension. Reason: The "targets" for the registered extension does not match the targets listed in the section "extensions.addedLinks[]" of the plugin.json file. Currently, this is only required in development but will be enforced also in production builds in the future.'
    );

    return true;
  }

  if (pluginJsonMetaInfo.description !== metaInfo.description) {
    log.warning(
      `${logPrefix} the "description" doesn't match with one in the plugin.json under "extensions.addedLinks[]".`
    );

    return true;
  }

  return false;
};

export const isAddedComponentMetaInfoMissing = (
  pluginId: string,
  metaInfo: PluginExtensionAddedComponentConfig,
  log: ExtensionsLog
) => {
  const app = config.apps[pluginId];
  const logPrefix = `Added component "${metaInfo.title}" -`;
  const pluginJsonMetaInfo = app ? app.extensions.addedComponents.find(({ title }) => title === metaInfo.title) : null;

  if (!app) {
    log.error(
      `Could not register added component extension. Reason: Couldn't find app plugin with plugin id "${pluginId}"`
    );
    return true;
  }

  if (!pluginJsonMetaInfo) {
    log.error(
      `Could not register added component extension. Reason: The extension was not recorded in the plugin.json. Added component extensions must be listed in the section "extensions.addedComponents[]". Currently, this is only required in development but will be enforced also in production builds in the future.`
    );

    return true;
  }

  const targets = Array.isArray(metaInfo.targets) ? metaInfo.targets : [metaInfo.targets];
  if (!targets.every((target) => pluginJsonMetaInfo.targets.includes(target))) {
    log.error(
      'Could not register added component extension. Reason: The "targets" for the registered extension does not match the targets listed in the section "extensions.addedComponents[]" of the plugin.json file. Currently, this is only required in development but will be enforced also in production builds in the future.'
    );

    return true;
  }

  if (pluginJsonMetaInfo.description !== metaInfo.description) {
    log.warning(
      `${logPrefix} the "description" doesn't match with one in the plugin.json under "extensions.addedComponents[]".`
    );

    return true;
  }

  return false;
};

export const isExposedComponentMetaInfoMissing = (
  pluginId: string,
  metaInfo: PluginExtensionExposedComponentConfig,
  log: ExtensionsLog
) => {
  const app = config.apps[pluginId];
  const logPrefix = `Exposed component "${metaInfo.id}" -`;
  const pluginJsonMetaInfo = app ? app.extensions.exposedComponents.find(({ id }) => id === metaInfo.id) : null;

  if (!app) {
    log.error(
      `Could not register exposed component extension. Reason: Couldn't find app plugin with plugin id "${pluginId}"`
    );
    return true;
  }

  if (!pluginJsonMetaInfo) {
    log.error(
      `Could not register exposed component extension. Reason: The extension was not recorded in the plugin.json. Exposed component extensions must be listed in the section "extensions.exposedComponents[]". Currently, this is only required in development but will be enforced also in production builds in the future.`
    );

    return true;
  }

  if (pluginJsonMetaInfo.title !== metaInfo.title) {
    log.error(
      'Could not register exposed component extension. Reason: The "targets" for the registered extension does not match the targets listed in the section "extensions.addedLinks[]" of the plugin.json file. Currently, this is only required in development but will be enforced also in production builds in the future.'
    );

    return true;
  }

  if (pluginJsonMetaInfo.description !== metaInfo.description) {
    log.warning(
      `${logPrefix} the "description" doesn't match with one in the plugin.json under "extensions.exposedComponents[]".`
    );

    return true;
  }

  return false;
};
