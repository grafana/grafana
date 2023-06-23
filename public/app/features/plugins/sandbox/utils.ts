import React from 'react';

import { SandboxedPluginObject } from './types';

export function isSandboxedPluginObject(value: unknown): value is SandboxedPluginObject {
  return !!value && typeof value === 'object' && value?.hasOwnProperty('plugin');
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}. This should never happen.`);
}

export function isReactClassComponent(obj: unknown): obj is React.Component {
  return obj instanceof React.Component;
}
