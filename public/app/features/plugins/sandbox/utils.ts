import { SandboxedPluginObject } from './types';

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isSandboxedPluginObject(value: unknown): value is SandboxedPluginObject {
  return !!value && typeof value === 'object' && value?.hasOwnProperty('plugin');
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}. This should never happen.`);
}
