import { Subscription } from 'rxjs';

import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { type ThunkResult } from 'app/types/store';

import { getVariable } from '../state/selectors';
import { type KeyedVariableIdentifier } from '../state/types';
import { hasOngoingTransaction } from '../utils';

import { getVariableQueryRunner } from './VariableQueryRunner';
import { variableQueryObserver } from './variableQueryObserver';

export const updateQueryVariableOptions = (
  identifier: KeyedVariableIdentifier,
  searchFilter?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const { rootStateKey } = identifier;
      if (!hasOngoingTransaction(rootStateKey, getState())) {
        // we might have cancelled a batch so then variable state is removed
        return;
      }

      const variableInState = getVariable(identifier, getState());
      if (variableInState.type !== 'query') {
        return;
      }

      const datasource = await getDataSourceSrv().get(variableInState.datasource ?? '');

      // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
      // variable will have the wrong current value as input
      await new Promise((resolve, reject) => {
        const subscription: Subscription = new Subscription();
        const observer = variableQueryObserver(resolve, reject, subscription);
        const responseSubscription = getVariableQueryRunner().getResponse(identifier).subscribe(observer);
        subscription.add(responseSubscription);

        getVariableQueryRunner().queueRequest({ identifier, datasource, searchFilter });
      });
    } catch (err) {
      if (err instanceof Error) {
        throw toDataQueryError(err);
      }
    }
  };
};

export function hasSelfReferencingQuery(name: string, query: any): boolean {
  if (typeof query === 'string' && query.match(new RegExp('\\$' + name + '(/| |$)'))) {
    return true;
  }

  const flattened = flattenQuery(query);

  for (let prop in flattened) {
    if (flattened.hasOwnProperty(prop)) {
      const value = flattened[prop];
      if (typeof value === 'string' && value.match(new RegExp('\\$' + name + '(/| |$)'))) {
        return true;
      }
    }
  }

  return false;
}

/*
 * Function that takes any object and flattens all props into one level deep object
 * */
export function flattenQuery(query: any) {
  if (typeof query !== 'object' || query === null) {
    return { query };
  }

  const keys = Object.keys(query);
  const flattened = keys.reduce<Record<string, any>>((all, key) => {
    const value = query[key];
    if (typeof value !== 'object' || value === null) {
      all[key] = value;
      return all;
    }

    const result = flattenQuery(value);
    for (let childProp in result) {
      if (result.hasOwnProperty(childProp)) {
        all[`${key}_${childProp}`] = result[childProp];
      }
    }

    return all;
  }, {});

  return flattened;
}
