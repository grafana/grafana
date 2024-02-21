import { Observable, OperatorFunction, ReplaySubject, Subject, firstValueFrom, map, scan, startWith, tap } from 'rxjs';

import { logWarning } from '@grafana/runtime';

import { PluginPreloadResult } from '../pluginPreloader';

import { PluginExtensionRegistry, PluginExtensionRegistryItem } from './types';
import { deepFreeze } from './utils';
import { isPluginExtensionConfigValid } from './validators';

export class ReactivePluginExtenionRegistry {
  private resultSubject: Subject<PluginPreloadResult>;
  private registrySubject: ReplaySubject<PluginExtensionRegistry>;

  constructor() {
    this.resultSubject = new Subject<PluginPreloadResult>();
    // This is the subject that we expose.
    // (It will buffer the last value on the stream - the registry - and emit it to new subscribers immediately.)
    this.registrySubject = new ReplaySubject<PluginExtensionRegistry>(1);

    this.resultSubject
      .pipe(
        tap((v) => console.log('emitted value', v)),
        createRegistryResults(),
        tap((v) => console.log('Registry created', v)),
        // Emit an empty object to start the stream (it is only going to do it once during construction, and then just passes down the values)
        startWith({}),
        map((registry) => deepFreeze(registry)),
        tap((v) => console.log('Deep freeze registry', v))
      )
      // Emitting the new registry to `this.registrySubject`
      .subscribe(this.registrySubject);
  }

  registerPlugin(result: PluginPreloadResult): void {
    this.resultSubject.next(result);
  }

  asObservable(): Observable<PluginExtensionRegistry> {
    return this.registrySubject.asObservable();
  }

  getRegistry(): Promise<PluginExtensionRegistry> {
    return firstValueFrom(this.asObservable());
  }
}

function createRegistryResults(): OperatorFunction<PluginPreloadResult, PluginExtensionRegistry> {
  return scan<PluginPreloadResult, PluginExtensionRegistry>((registry, result) => {
    const { pluginId, extensionConfigs, error } = result;

    if (error) {
      logWarning(`"${pluginId}" plugin failed to load, skip registering its extensions.`);
      return registry;
    }

    for (const extensionConfig of extensionConfigs) {
      const { extensionPointId } = extensionConfig;

      if (!extensionConfig || !isPluginExtensionConfigValid(pluginId, extensionConfig)) {
        return registry;
      }

      let registryItem: PluginExtensionRegistryItem = {
        config: extensionConfig,

        // Additional meta information about the extension
        pluginId,
      };

      if (!Array.isArray(registry[extensionPointId])) {
        registry[extensionPointId] = [registryItem];
      } else {
        registry[extensionPointId].push(registryItem);
      }
    }

    return registry;
  }, {});
}
