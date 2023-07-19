import React from 'react';

import { LogContext } from '@grafana/faro-web-sdk';
import { logWarning as logWarningRuntime, logError as logErrorRuntime, config } from '@grafana/runtime';

import { SandboxedPluginObject } from './types';

const monitorOnly = Boolean(config.featureToggles.frontendSandboxMonitorOnly);

export function isSandboxedPluginObject(value: unknown): value is SandboxedPluginObject {
  return !!value && typeof value === 'object' && value?.hasOwnProperty('plugin');
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}. This should never happen.`);
}

export function isReactClassComponent(obj: unknown): obj is React.Component {
  return obj instanceof React.Component;
}

export function logWarning(message: string, context?: LogContext) {
  context = {
    ...context,
    source: 'sandbox',
    monitorOnly: String(monitorOnly),
  };
  logWarningRuntime(message, context);
}

export function logError(error: Error, context?: LogContext) {
  context = {
    ...context,
    source: 'sandbox',
    monitorOnly: String(monitorOnly),
  };
  logErrorRuntime(error, context);
}
