import { GetPluginExtensionsOptions, UsePluginComponentsResult } from './getPluginExtensions';

export type UsePluginComponents<Props extends object = {}> = (
  options: GetPluginExtensionsOptions
) => UsePluginComponentsResult<Props>;

let singleton: UsePluginComponents | undefined;

export function setPluginComponentsHook(hook: UsePluginComponents): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginComponentsHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function usePluginComponents<Props extends object = {}>(
  options: GetPluginExtensionsOptions
): UsePluginComponentsResult<Props> {
  if (!singleton) {
    throw new Error('setPluginComponentsHook(options) can only be used after the Grafana instance has started.');
  }
  return singleton(options) as UsePluginComponentsResult<Props>;
}
