import { Observable, ReplaySubject, Subject, firstValueFrom, map, scan, startWith } from 'rxjs';

import { deepFreeze } from '../extensions/utils';
import { PluginPreloadResult } from '../pluginPreloader';

type RegistryOptions<T extends Record<string | symbol, unknown>> = {
  addToState: (state: T, result: PluginPreloadResult) => T;
  getInitialState: () => T;
};

export class Registry<T extends Record<string | symbol, unknown>> {
  private resultSubject: Subject<PluginPreloadResult>;
  private registrySubject: ReplaySubject<T>;

  constructor(options: RegistryOptions<T>) {
    const { addToState: mapToRegistry, getInitialState: createDefault } = options;
    this.resultSubject = new Subject<PluginPreloadResult>();
    // This is the subject that we expose.
    // (It will buffer the last value on the stream - the registry - and emit it to new subscribers immediately.)
    this.registrySubject = new ReplaySubject<T>(1);

    this.resultSubject
      .pipe(
        scan(mapToRegistry, createDefault()),
        // Emit an empty registry to start the stream (it is only going to do it once during construction, and then just passes down the values)
        startWith(createDefault()),
        map((registry) => deepFreeze(registry))
      )
      // Emitting the new registry to `this.registrySubject`
      .subscribe(this.registrySubject);
  }

  register(result: PluginPreloadResult): void {
    this.resultSubject.next(result);
  }

  asObservable(): Observable<T> {
    return this.registrySubject.asObservable();
  }

  getState(): Promise<T> {
    return firstValueFrom(this.asObservable());
  }
}
