import { type Observable } from 'rxjs';

import type { PluginExtensionComponent } from '@grafana/data/types';

type GetObservablePluginComponentsOptions = {
  context?: object | Record<string, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
};

export type GetObservablePluginComponents = (
  options: GetObservablePluginComponentsOptions
) => Observable<PluginExtensionComponent[]>;

let singleton: GetObservablePluginComponents | undefined;

export function setGetObservablePluginComponents(fn: GetObservablePluginComponents): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error(
      'setGetObservablePluginComponents() function should only be called once, when Grafana is starting.'
    );
  }

  singleton = fn;
}

export function getObservablePluginComponents(
  options: GetObservablePluginComponentsOptions
): Observable<PluginExtensionComponent[]> {
  if (!singleton) {
    throw new Error('getObservablePluginComponents() can only be used after the Grafana instance has started.');
  }

  return singleton(options);
}
