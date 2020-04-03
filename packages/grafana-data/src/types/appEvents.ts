import { eventFactory } from './utils';

export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

export type AlertPayload = [string, string?];

export const alertSuccess = eventFactory<AlertPayload>('alert-success');
export const alertWarning = eventFactory<AlertPayload>('alert-warning');
export const alertError = eventFactory<AlertPayload>('alert-error');

export interface EventEmitter {
  /**
   * Emits an `event` with `payload`.
   */
  emit<T>(event: AppEvent<T>, payload: T): void;

  /**
   * Subscribe to `event` with `handler()` when emitted.
   */
  on<T>(event: AppEvent<T>, handler: (payload: T) => void, scope?: any): void;

  /**
   * Remove the `handler()` from `event`.
   */
  off<T>(event: AppEvent<T>, handler: (payload: T) => void): void;
}
