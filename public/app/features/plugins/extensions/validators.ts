import {
  type PluginExtensionAddedLinkConfig,
  type PluginExtension,
  type PluginExtensionLink,
  type PluginContextType,
  type PluginExtensionAddedComponentConfig,
  type PluginExtensionExposedComponentConfig,
  type PluginExtensionAddedFunctionConfig,
  PluginExtensionPoints,
} from '@grafana/data';
import { PluginAddedLinksConfigureFunc } from '@grafana/data/internal';
import { config, isPluginExtensionLink } from '@grafana/runtime';

import * as errors from './errors';
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
  isInsidePlugin,
  isCoreGrafanaPlugin,
  log,
}: {
  extensionPointId: string;
  pluginId: string;
  isInsidePlugin: boolean;
  isCoreGrafanaPlugin: boolean;
  log: ExtensionsLog;
}) {
  const startsWithPluginId =
    extensionPointId.startsWith(`${pluginId}/`) || extensionPointId.startsWith(`plugins/${pluginId}/`);

  if (isInsidePlugin && !isCoreGrafanaPlugin && !startsWithPluginId) {
    log.error(errors.INVALID_EXTENSION_POINT_ID_PLUGIN(pluginId, extensionPointId));
    return false;
  }

  if (!isInsidePlugin && !extensionPointId.startsWith('grafana/')) {
    log.error(errors.INVALID_EXTENSION_POINT_ID_GRAFANA_PREFIX(extensionPointId));
    return false;
  }

  if (
    !isInsidePlugin &&
    !Object.values<string>(PluginExtensionPoints).some(
      (extension) => extension === extensionPointId || new RegExp(extension).test(extensionPointId)
    )
  ) {
    log.error(errors.INVALID_EXTENSION_POINT_ID_GRAFANA_EXPOSED);
    return false;
  }

  return true;
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
  const logPrefix = 'Could not register link extension. Reason:';
  const app = config.apps[pluginId];
  const pluginJsonMetaInfo = app ? app.extensions.addedLinks.filter(({ title }) => title === metaInfo.title) : null;

  if (!app) {
    log.error(`${logPrefix} ${errors.APP_NOT_FOUND(pluginId)}`);
    return true;
  }

  if (!pluginJsonMetaInfo || pluginJsonMetaInfo.length === 0) {
    log.error(`${logPrefix} ${errors.ADDED_LINK_META_INFO_MISSING}`);
    return true;
  }

  const targets = Array.isArray(metaInfo.targets) ? metaInfo.targets : [metaInfo.targets];
  if (!targets.every((target) => pluginJsonMetaInfo.some(({ targets }) => targets.includes(target)))) {
    log.error(`${logPrefix} ${errors.TARGET_NOT_MATCHING_META_INFO}`);
    return true;
  }

  if (pluginJsonMetaInfo.some(({ description }) => description !== metaInfo.description)) {
    log.warning(errors.DESCRIPTION_NOT_MATCHING_META_INFO);
  }

  return false;
};

export const isAddedFunctionMetaInfoMissing = (
  pluginId: string,
  metaInfo: PluginExtensionAddedFunctionConfig,
  log: ExtensionsLog
) => {
  const logPrefix = 'Could not register function extension. Reason:';
  const app = config.apps[pluginId];
  const pluginJsonMetaInfo = app ? app.extensions.addedFunctions.filter(({ title }) => title === metaInfo.title) : null;

  if (!app) {
    log.error(`${logPrefix} ${errors.APP_NOT_FOUND(pluginId)}`);
    return true;
  }

  if (!pluginJsonMetaInfo || pluginJsonMetaInfo.length === 0) {
    log.error(`${logPrefix} ${errors.ADDED_FUNCTION_META_INFO_MISSING}`);
    return true;
  }

  const targets = Array.isArray(metaInfo.targets) ? metaInfo.targets : [metaInfo.targets];
  if (!targets.every((target) => pluginJsonMetaInfo.some(({ targets }) => targets.includes(target)))) {
    log.error(`${logPrefix} ${errors.TARGET_NOT_MATCHING_META_INFO}`);
    return true;
  }

  if (pluginJsonMetaInfo.some(({ description }) => description !== metaInfo.description)) {
    log.warning(errors.DESCRIPTION_NOT_MATCHING_META_INFO);
  }

  return false;
};

export const isAddedComponentMetaInfoMissing = (
  pluginId: string,
  metaInfo: PluginExtensionAddedComponentConfig,
  log: ExtensionsLog
) => {
  const logPrefix = 'Could not register component extension. Reason:';
  const app = config.apps[pluginId];
  const pluginJsonMetaInfo = app
    ? app.extensions.addedComponents.filter(({ title }) => title === metaInfo.title)
    : null;

  if (!app) {
    log.error(`${logPrefix} ${errors.APP_NOT_FOUND(pluginId)}`);
    return true;
  }

  if (!pluginJsonMetaInfo || pluginJsonMetaInfo.length === 0) {
    log.error(`${logPrefix} ${errors.ADDED_COMPONENT_META_INFO_MISSING}`);
    return true;
  }

  const targets = Array.isArray(metaInfo.targets) ? metaInfo.targets : [metaInfo.targets];
  if (!targets.every((target) => pluginJsonMetaInfo.some(({ targets }) => targets.includes(target)))) {
    log.error(`${logPrefix} ${errors.TARGET_NOT_MATCHING_META_INFO}`);
    return true;
  }

  if (pluginJsonMetaInfo.some(({ description }) => description !== metaInfo.description)) {
    log.warning(errors.DESCRIPTION_NOT_MATCHING_META_INFO);
  }

  return false;
};

export const isExposedComponentMetaInfoMissing = (
  pluginId: string,
  metaInfo: PluginExtensionExposedComponentConfig,
  log: ExtensionsLog
) => {
  const logPrefix = 'Could not register exposed component extension. Reason:';
  const app = config.apps[pluginId];
  const pluginJsonMetaInfo = app ? app.extensions.exposedComponents.filter(({ id }) => id === metaInfo.id) : null;

  if (!app) {
    log.error(`${logPrefix} ${errors.APP_NOT_FOUND(pluginId)}`);
    return true;
  }

  if (!pluginJsonMetaInfo || pluginJsonMetaInfo.length === 0) {
    log.error(`${logPrefix} ${errors.EXPOSED_COMPONENT_META_INFO_MISSING}`);
    return true;
  }

  if (pluginJsonMetaInfo.some(({ title }) => title !== metaInfo.title)) {
    log.error(`${logPrefix} ${errors.TITLE_NOT_MATCHING_META_INFO}`);
    return true;
  }

  if (pluginJsonMetaInfo.some(({ description }) => description !== metaInfo.description)) {
    log.warning(errors.DESCRIPTION_NOT_MATCHING_META_INFO);
  }

  return false;
};
