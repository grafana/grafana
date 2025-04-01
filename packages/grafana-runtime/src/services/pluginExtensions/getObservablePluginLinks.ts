import { Observable } from 'rxjs';

import { PluginExtensionLink } from '@grafana/data';

type GetObservablePluginLinksOptions = {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
};

export type GetObservablePluginLinks = (options: GetObservablePluginLinksOptions) => Observable<PluginExtensionLink[]>;

let singleton: GetObservablePluginLinks | undefined;

export function setGetObservablePluginLinks(fn: GetObservablePluginLinks): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setGetObservablePluginLinks() function should only be called once, when Grafana is starting.');
  }

  singleton = fn;
}

export function getObservablePluginLinks(options: GetObservablePluginLinksOptions): Observable<PluginExtensionLink[]> {
  if (!singleton) {
    throw new Error('getObservablePluginLinks() can only be used after the Grafana instance has started.');
  }

  return singleton(options);
}
