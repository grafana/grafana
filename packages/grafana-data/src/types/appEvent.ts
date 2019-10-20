export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}
