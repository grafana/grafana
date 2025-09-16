import { PluginExtensionLink } from '@grafana/data';

export type UsePluginLinksOptions = {
  extensionPointId: string;
  context?: object | Record<string | symbol, unknown>;
  limitPerPlugin?: number;
};

export type UsePluginLinksResult = {
  isLoading: boolean;
  links: PluginExtensionLink[];
};

export type UsePluginLinks = (options: UsePluginLinksOptions) => UsePluginLinksResult;

let singleton: UsePluginLinks | undefined;

export function setPluginLinksHook(hook: UsePluginLinks): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginLinksHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function usePluginLinks(options: UsePluginLinksOptions): UsePluginLinksResult {
  if (!singleton) {
    throw new Error('setPluginLinksHook(options) can only be used after the Grafana instance has started.');
  }
  return singleton(options);
}
