import { Observable, ReplaySubject, Subject, firstValueFrom, map, scan, startWith } from 'rxjs';

import { deepFreeze } from '../utils';

export type PluginExtensionConfigs<T> = {
  pluginId: string;
  configs: T[];
};

export type RegistryItem<T> = {
  pluginId: string;
  config: T;
};

export type RegistryType<T> = Record<string | symbol, RegistryItem<T>>;

type ConstructorOptions<T> = {
  initialState: RegistryType<T>;
};

// This is the base-class used by the separate specific registries.
export abstract class Registry<T> {
  private resultSubject: Subject<PluginExtensionConfigs<T>>;
  private registrySubject: ReplaySubject<RegistryType<T>>;

  constructor(options: ConstructorOptions<T>) {
    const { initialState } = options;
    this.resultSubject = new Subject<PluginExtensionConfigs<T>>();
    // This is the subject that we expose.
    // (It will buffer the last value on the stream - the registry - and emit it to new subscribers immediately.)
    this.registrySubject = new ReplaySubject<RegistryType<T>>(1);

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

  abstract mapToRegistry(registry: RegistryType<T>, item: PluginExtensionConfigs<T>): RegistryType<T>;

  register(result: PluginExtensionConfigs<T>): void {
    this.resultSubject.next(result);
  }

  asObservable(): Observable<RegistryType<T>> {
    return this.registrySubject.asObservable();
  }

  getState(): Promise<RegistryType<T>> {
    return firstValueFrom(this.asObservable());
  }
}
