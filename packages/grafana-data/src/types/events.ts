export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

const typeList: Set<string> = new Set();
export function eventFactory<T = undefined>(name: string): AppEvent<T> {
  if (typeList.has(name)) {
    throw new Error(`There is already an event defined with type '${name}'`);
  }

  typeList.add(name);
  return { name };
}

export type AlertPayload = [string, string?];
export const alertWarning = eventFactory<AlertPayload>('alert-warning');
export const alertSuccess = eventFactory<AlertPayload>('alert-success');
export const alertError = eventFactory<AlertPayload>('alert-error');
