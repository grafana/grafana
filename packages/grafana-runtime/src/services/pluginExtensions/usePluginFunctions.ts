import { UsePluginFunctionsOptions, UsePluginFunctionsResult } from './getPluginExtensions';

export type UsePluginFunctions<T> = (options: UsePluginFunctionsOptions) => UsePluginFunctionsResult<T>;

let singleton: UsePluginFunctions<unknown> | undefined;

export function setPluginFunctionsHook(hook: UsePluginFunctions<unknown>): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setUsePluginFunctionsHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function usePluginFunctions<T>(options: UsePluginFunctionsOptions): UsePluginFunctionsResult<T> {
  if (!singleton) {
    throw new Error('usePluginFunctions(options) can only be used after the Grafana instance has started.');
  }
  return singleton(options) as UsePluginFunctionsResult<T>;
}
