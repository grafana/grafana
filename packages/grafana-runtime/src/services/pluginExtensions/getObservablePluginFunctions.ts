import { Observable } from 'rxjs';

import { PluginExtensionFunction } from '@grafana/data';

type GetObservablePluginFunctionsOptions = {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
};

export type GetObservablePluginFunctions = (
  options: GetObservablePluginFunctionsOptions
) => Observable<PluginExtensionFunction[]>;

let singleton: GetObservablePluginFunctions | undefined;

export function setGetObservablePluginFunctions(fn: GetObservablePluginFunctions): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setObservablePluginFunctions() function should only be called once, when Grafana is starting.');
  }

  singleton = fn;
}

export function getObservablePluginFunctions(
  options: GetObservablePluginFunctionsOptions
): Observable<PluginExtensionFunction[]> {
  if (!singleton) {
    throw new Error('getObservablePluginFunctions() can only be used after the Grafana instance has started.');
  }

  return singleton(options);
}
