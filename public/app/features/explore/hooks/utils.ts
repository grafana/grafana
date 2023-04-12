import { isEmpty, isObject, mapValues, omitBy } from 'lodash';

import { ExploreUrlState } from '@grafana/data';
import { clearQueryKeys } from 'app/core/utils/explore';
import { ExploreItemState } from 'app/types';

import { toRawTimeRange } from '../utils/time';

/**
 * recursively walks an object, removing keys where the value is undefined
 * if the resulting object is empty, returns undefined
 **/
function pruneObject(obj: object): object | undefined {
  let pruned = mapValues(obj, (value) => (isObject(value) ? pruneObject(value) : value));
  pruned = omitBy<typeof pruned>(pruned, isEmpty);
  if (isEmpty(pruned)) {
    return undefined;
  }
  return pruned;
}

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
    // lets just fallback instead of crashing.
    datasource: pane.datasourceInstance?.uid || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toRawTimeRange(pane.range),
    // don't include panelsState in the url unless a piece of state is actually set
    panelsState: pruneObject(pane.panelsState),
  };
}
