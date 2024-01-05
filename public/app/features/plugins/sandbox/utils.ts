import { isNearMembraneProxy } from '@locker/near-membrane-shared';
import React from 'react';

import { PluginSignatureType, PluginType } from '@grafana/data';
import { LogContext } from '@grafana/faro-web-sdk';
import { config, createMonitoringLogger } from '@grafana/runtime';

import { getPluginSettings } from '../pluginSettings';

import { SandboxedPluginObject } from './types';

const monitorOnly = Boolean(config.featureToggles.frontendSandboxMonitorOnly);

export function isSandboxedPluginObject(value: unknown): value is SandboxedPluginObject {
  return !!value && typeof value === 'object' && value?.hasOwnProperty('plugin');
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}. This should never happen.`);
}

const sandboxLogger = createMonitoringLogger('sandbox', { monitorOnly: String(monitorOnly) });

export function isReactClassComponent(obj: unknown): obj is React.Component {
  return obj instanceof React.Component;
}

export function logWarning(message: string, context?: LogContext) {
  sandboxLogger.logWarning(message, context);
}

export function logError(error: Error, context?: LogContext) {
  sandboxLogger.logError(error, context);
}

export function logInfo(message: string, context?: LogContext) {
  sandboxLogger.logInfo(message, context);
}

export async function isFrontendSandboxSupported({
  isAngular,
  pluginId,
}: {
  isAngular?: boolean;
  pluginId: string;
}): Promise<boolean> {
  // Only if the feature is not enabled no support for sandbox
  if (!Boolean(config.featureToggles.pluginsFrontendSandbox)) {
    return false;
  }

  // no support for angular plugins
  if (isAngular) {
    return false;
  }

  // To fast test and debug the sandbox in the browser.
  const sandboxDisableQueryParam = location.search.includes('nosandbox') && config.buildInfo.env === 'development';
  if (sandboxDisableQueryParam) {
    return false;
  }

  // if disabled by configuration
  const isPluginExcepted = config.disableFrontendSandboxForPlugins.includes(pluginId);
  if (isPluginExcepted) {
    return false;
  }

  // no sandbox in test mode. it often breaks e2e tests
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  // we don't run grafana-own apps in the sandbox
  const pluginMeta = await getPluginSettings(pluginId);
  if (pluginMeta.type === PluginType.app && pluginMeta.signatureType === PluginSignatureType.grafana) {
    return false;
  }

  return true;
}

function isRegex(value: unknown): value is RegExp {
  return value?.constructor?.name === 'RegExp';
}

/**
 * Near membrane regex proxy objects behave just exactly the same as regular RegExp objects
 * with only one difference: they are not `instanceof RegExp`.
 * This function takes a structure and makes sure any regex that is a nearmembraneproxy
 * and returns the same regex but in the bluerealm
 */
export function unboxRegexesFromMembraneProxy(structure: unknown): unknown {
  if (!structure) {
    return structure;
  }

  // Proxy regexes loook and behave like proxies but they
  // are not instanceof RegExp
  if (isRegex(structure) && isNearMembraneProxy(structure)) {
    return new RegExp(structure);
  }

  if (Array.isArray(structure)) {
    return structure.map(unboxRegexesFromMembraneProxy);
  }
  if (typeof structure === 'object') {
    return Object.keys(structure).reduce((acc, key) => {
      Reflect.set(acc, key, unboxRegexesFromMembraneProxy(Reflect.get(structure, key)));
      return acc;
    }, {});
  }
  return structure;
}
