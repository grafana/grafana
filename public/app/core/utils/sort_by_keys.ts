import _ from 'lodash';

export default function sortByKeys(input) {
  if (_.isArray(input)) {
    var newArray = [];
    _.forEach(
      input,
      function(item) { newArray.push(sortByKeys(item)); }
    );
    return newArray;
  }

  if (_.isPlainObject(input)) {
    var sortedObject = {};
    _.forEach(
      _.keys(input).sort(),
      function(key) { sortedObject[key] = sortByKeys(input[key]); }
    );
    return sortedObject;
  }

  return input;
}
