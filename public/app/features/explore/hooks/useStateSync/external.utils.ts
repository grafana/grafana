import { isEmpty, isObject, mapValues, omitBy } from 'lodash';

import { ExploreUrlState, toURLRange } from '@grafana/data';
import { clearQueryKeys } from 'app/core/utils/explore';
import { ExploreItemState } from 'app/types/explore';

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
    // lets just fallback instead of crashing.
    datasource: pane.datasourceInstance?.uid || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toURLRange(pane.range.raw),
    // don't include panelsState in the url unless a piece of state is actually set
    panelsState: pruneObject(pane.panelsState),
    compact: pane.compact,
  };
}

/**
 * @todo this has zero test coverage and it doesn't work as expected, objects with values are pruned
 * recursively walks an object, removing keys where the value is undefined
 * if the resulting object is empty, returns undefined
 **/
function pruneObject(obj: object): object | undefined {
  let pruned = mapValues(obj, (value: unknown) => {
    if (isObject(value)) {
      if (Array.isArray(value)) {
        // For arrays, recursively prune each item and filter out empty results
        const prunedArray = value
          .map((item: unknown) => (isObject(item) ? pruneObject(item) : item))
          .filter((item: unknown) => !isEmpty(item));
        return prunedArray.length > 0 ? prunedArray : undefined;
      }
      return pruneObject(value);
    }
    return value;
  });

  // @todo this will fail to prune sub-objects that have a mix of null and non null values
  if (Object.values(pruned).filter((a) => a !== undefined && a !== null).length === 0) {
    pruned = omitBy<typeof pruned>(pruned, isEmpty);
  }

  if (isEmpty(pruned)) {
    return undefined;
  }
  return pruned;
}
