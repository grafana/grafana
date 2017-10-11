import _ from 'lodash';

export default function sortByKeys(input) {
  if (_.isArray(input)) {
    return input.map(sortByKeys);
  }

  if (_.isPlainObject(input)) {
    var sortedObject = {};
    for (let key of _.keys(input).sort()) {
      sortedObject[key] = sortByKeys(input[key]);
    }
    return sortedObject;
  }

  return input;
}
