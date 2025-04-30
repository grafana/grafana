import { isNearMembraneProxy } from '@locker/near-membrane-shared';
import { cloneDeep } from 'lodash';
import * as React from 'react';

import { LogContext } from '@grafana/faro-web-sdk';
import { createMonitoringLogger } from '@grafana/runtime';

import { SandboxedPluginObject } from './types';

export function isSandboxedPluginObject(value: unknown): value is SandboxedPluginObject {
  return !!value && typeof value === 'object' && value?.hasOwnProperty('plugin');
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}. This should never happen.`);
}

const sandboxLogger = createMonitoringLogger('sandbox');

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

export function unboxNearMembraneProxies(structure: unknown): unknown {
  if (!structure) {
    return structure;
  }

  if (isNearMembraneProxy(structure)) {
    return cloneDeep(structure);
  }

  if (Array.isArray(structure)) {
    return structure.map(unboxNearMembraneProxies);
  }
  if (typeof structure === 'object') {
    return Object.keys(structure).reduce((acc, key) => {
      Reflect.set(acc, key, unboxNearMembraneProxies(Reflect.get(structure, key)));
      return acc;
    }, {});
  }
  return structure;
}
