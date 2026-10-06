import { type Observable } from 'rxjs';

import { type PluginExtensionFunction } from '@grafana/data';

type GetObservablePluginFunctionsOptions = {
  extensionPointId: string;
  limitPerPlugin?: number;
};

export type GetObservablePluginFunctions = <Signature>(
  options: GetObservablePluginFunctionsOptions
) => Observable<Array<PluginExtensionFunction<Signature>>>;

let singleton: GetObservablePluginFunctions | undefined;

export function setGetObservablePluginFunctions(fn: GetObservablePluginFunctions): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setGetObservablePluginFunctions() function should only be called once, when Grafana is starting.');
  }

  singleton = fn;
}

export function getObservablePluginFunctions<Signature>(
  options: GetObservablePluginFunctionsOptions
): Observable<Array<PluginExtensionFunction<Signature>>> {
  if (!singleton) {
    throw new Error('getObservablePluginFunctions() can only be used after the Grafana instance has started.');
  }

  return singleton<Signature>(options);
}
