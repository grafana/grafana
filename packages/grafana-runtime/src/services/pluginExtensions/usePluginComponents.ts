import { type ComponentTypeWithExtensionMeta } from '@grafana/data';

export type UsePluginComponentsOptions = {
  extensionPointId: string;
  limitPerPlugin?: number;
};

export type UsePluginComponentsResult<Props = {}> = {
  components: Array<ComponentTypeWithExtensionMeta<Props>>;
  isLoading: boolean;
};

export type UsePluginComponents<Props extends object = {}> = (
  options: UsePluginComponentsOptions
) => UsePluginComponentsResult<Props>;

let singleton: UsePluginComponents | undefined;

export function setPluginComponentsHook(hook: UsePluginComponents): void {
  // We allow overriding the hook in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginComponentsHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function usePluginComponents<Props extends object = {}>(
  options: UsePluginComponentsOptions
): UsePluginComponentsResult<Props> {
  if (!singleton) {
    throw new Error('setPluginComponentsHook(options) can only be used after the Grafana instance has started.');
  }
  return singleton(options) as UsePluginComponentsResult<Props>;
}
