import { eventFactory } from './utils';

export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

export type AlertPayload = [string, string?];

export const alertSuccess = eventFactory<AlertPayload>('alert-success');
export const alertWarning = eventFactory<AlertPayload>('alert-warning');
export const alertError = eventFactory<AlertPayload>('alert-error');
