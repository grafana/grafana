import { ThunkResult } from './store';

export type Dethunked<T extends (...args: any) => any> = T extends (...any: infer S) => ThunkResult<infer T>
  ? (...any: S) => T
  : never;
