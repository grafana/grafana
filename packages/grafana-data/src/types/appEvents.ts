import { eventFactory } from './utils';

export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppEvents {
  export type AlertPayload = [string, string?];

  export const alertSuccess = eventFactory<AlertPayload>('alert-success');
  export const alertWarning = eventFactory<AlertPayload>('alert-warning');
  export const alertError = eventFactory<AlertPayload>('alert-error');
}
