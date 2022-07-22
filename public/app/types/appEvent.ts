import { IAngularEvent } from 'angular';

import { AppEvent } from '@grafana/data';

export interface AppEventEmitter {
  /**
   * DEPRECATED.
   */
  appEvent(name: string, data?: any): void;

  appEvent<T extends undefined>(event: AppEvent<T>): void;
  // This overload allows for omitting the appEvent payload if the payload's type only contains optional properties
  appEvent<T extends (U extends any ? Partial<T> : unknown) extends T ? Partial<T> : never, U = any>(
    event: AppEvent<T>
  ): void;
  appEvent<T>(event: AppEvent<T>, payload: T): void;
}

export interface AppEventConsumer {
  onAppEvent(name: string, callback: (event: IAngularEvent, ...args: any[]) => void, localScope?: any): void;
  onAppEvent<T>(event: AppEvent<T>, callback: (event: IAngularEvent, ...args: any[]) => void, localScope?: any): void;
}
