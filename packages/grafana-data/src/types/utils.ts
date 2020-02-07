import { AppEvent } from './appEvents';

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
export type Subtract<T, K> = Omit<T, keyof K>;

const typeList: Set<string> = new Set();
export function eventFactory<T = undefined>(name: string): AppEvent<T> {
  if (typeList.has(name)) {
    throw new Error(`There is already an event defined with type '${name}'`);
  }

  typeList.add(name);
  return { name };
}
