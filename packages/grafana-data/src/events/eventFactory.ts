import { AppEvent } from './types';

const typeList: Set<string> = new Set();

export function eventFactory<T = undefined>(name: string): AppEvent<T> {
  if (typeList.has(name)) {
    throw new Error(`There is already an event defined with type '${name}'`);
  }

  typeList.add(name);
  return { name };
}
