export interface AppEvent<T> {
  readonly name: string;
  readonly origin?: string;
  payload?: T;
}
