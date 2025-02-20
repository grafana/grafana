export type UsePluginComponent<Props extends object = {}> = (componentId: string) => UsePluginComponentResult<Props>;

export type UsePluginComponentResult<Props = {}> = {
  component: React.ComponentType<Props> | undefined | null;
  isLoading: boolean;
};

let singleton: UsePluginComponent | undefined;

export function setPluginComponentHook(hook: UsePluginComponent): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginComponentHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function usePluginComponent<Props extends object = {}>(componentId: string): UsePluginComponentResult<Props> {
  if (!singleton) {
    throw new Error('setPluginComponentHook(options) can only be used after the Grafana instance has started.');
  }
  return singleton(componentId) as UsePluginComponentResult<Props>;
}
