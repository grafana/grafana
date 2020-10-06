import _ from 'lodash';

export default function sortByKeys(input: any): any {
  if (_.isArray(input)) {
    return input.map(sortByKeys);
  }

  if (_.isPlainObject(input)) {
    const sortedObject: any = {};
    for (const key of _.keys(input).sort()) {
      sortedObject[key] = sortByKeys(input[key]);
    }
    return sortedObject;
  }

  return input;
}
