import { isArray, isPlainObject, keys } from 'lodash';

export default function sortByKeys(input: any): any {
  if (isArray(input)) {
    return input.map(sortByKeys);
  }

  if (isPlainObject(input)) {
    const sortedObject: any = {};
    for (const key of keys(input).sort()) {
      sortedObject[key] = sortByKeys(input[key]);
    }
    return sortedObject;
  }

  return input;
}
