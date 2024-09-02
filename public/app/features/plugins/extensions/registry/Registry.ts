import { Observable, ReplaySubject, Subject, firstValueFrom, map, scan, startWith } from 'rxjs';

import { deepFreeze } from '../utils';

export type PluginExtensionConfigs<T> = {
  pluginId: string;
  configs: T[];
};

export type RegistryType<T> = Record<string | symbol, T>;

type ConstructorOptions<T> = {
  initialState: RegistryType<T>;
};

export class ReadOnlyRegistry<T> {
  private registryObservable: ReplaySubject<RegistryType<T>>;

  constructor(registryObservable: ReplaySubject<RegistryType<T>>) {
    this.registryObservable = registryObservable;
  }

  asObservable(): Observable<RegistryType<T>> {
    return this.registryObservable.asObservable();
  }

  getState(): Promise<RegistryType<T>> {
    return firstValueFrom(this.asObservable());
  }
}

// This is the base-class used by the separate specific registries.
export abstract class Registry<TRegistryValue, TMapType> {
  private resultSubject: Subject<PluginExtensionConfigs<TMapType>>;
  private registrySubject: ReplaySubject<RegistryType<TRegistryValue>>;

  constructor(options: ConstructorOptions<TRegistryValue>) {
    const { initialState } = options;
    this.resultSubject = new Subject<PluginExtensionConfigs<TMapType>>();
    // This is the subject that we expose.
    // (It will buffer the last value on the stream - the registry - and emit it to new subscribers immediately.)
    this.registrySubject = new ReplaySubject<RegistryType<TRegistryValue>>(1);

    this.resultSubject
      .pipe(
        scan(this.mapToRegistry, initialState),
        // Emit an empty registry to start the stream (it is only going to do it once during construction, and then just passes down the values)
        startWith(initialState),
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
    this.resultSubject.next(result);
  }

  asObservable(): Observable<RegistryType<TRegistryValue>> {
    return this.registrySubject.asObservable();
  }

  getState(): Promise<RegistryType<TRegistryValue>> {
    return firstValueFrom(this.asObservable());
  }

  // Returns a read-only version of the registry.
  readOnly(): ReadOnlyRegistry<TRegistryValue> {
    return new ReadOnlyRegistry(this.registrySubject);
  }
}
