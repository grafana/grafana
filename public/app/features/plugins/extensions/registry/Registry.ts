import { Observable, ReplaySubject, Subject, firstValueFrom, map, scan, startWith } from 'rxjs';

import { deepFreeze } from '../utils';

export type PluginExtensionConfigs<T> = {
  pluginId: string;
  configs: T[];
};

export type RegistryType<T> = Record<string | symbol, T>;

// This is the base-class used by the separate specific registries.
export abstract class Registry<TRegistryValue, TMapType> {
  // Used in cases when we would like to pass a read-only registry to plugin.
  // In these cases we are passing in the `registrySubject` to the constructor.
  // (If TRUE `initialState` is ignored.)
  private isReadOnly: boolean;
  // This is the subject that receives extension configs for a loaded plugin.
  private resultSubject: Subject<PluginExtensionConfigs<TMapType>>;
  // This is the subject that we expose.
  // (It will buffer the last value on the stream - the registry - and emit it to new subscribers immediately.)
  private registrySubject: ReplaySubject<RegistryType<TRegistryValue>>;

  constructor(options: {
    registrySubject?: ReplaySubject<RegistryType<TRegistryValue>>;
    initialState?: RegistryType<TRegistryValue>;
  }) {
    this.resultSubject = new Subject<PluginExtensionConfigs<TMapType>>();
    this.isReadOnly = false;

    // If the registry subject (observable) is provided, it means that all the registry updates are taken care of outside of this class -> it is read-only.
    if (options.registrySubject) {
      this.registrySubject = options.registrySubject;
      this.isReadOnly = true;

      return;
    }

    this.registrySubject = new ReplaySubject<RegistryType<TRegistryValue>>(1);
    this.resultSubject
      .pipe(
        scan(this.mapToRegistry, options.initialState ?? {}),
        // Emit an empty registry to start the stream (it is only going to do it once during construction, and then just passes down the values)
        startWith(options.initialState ?? {}),
        map((registry) => deepFreeze(registry))
      )
      // Emitting the new registry to `this.registrySubject`
      .subscribe(this.registrySubject);
  }

  abstract mapToRegistry(
    registry: RegistryType<TRegistryValue>,
    item: PluginExtensionConfigs<TMapType>
  ): RegistryType<TRegistryValue>;

  register(result: PluginExtensionConfigs<TMapType>): void {
    if (this.isReadOnly) {
      throw new Error('Cannot register to a read-only registry');
    }

    this.resultSubject.next(result);
  }

  asObservable(): Observable<RegistryType<TRegistryValue>> {
    return this.registrySubject.asObservable();
  }

  getState(): Promise<RegistryType<TRegistryValue>> {
    return firstValueFrom(this.asObservable());
  }

  // Returns a read-only version of the registry.
  readOnly() {
    return new (this.constructor as new (options: {
      registrySubject: ReplaySubject<RegistryType<TRegistryValue>>;
    }) => this)({
      registrySubject: this.registrySubject,
    });
  }
}
