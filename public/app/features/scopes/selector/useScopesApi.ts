import { useEffect, useMemo } from 'react';
import { shallowEqual } from 'react-redux';

import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { type Scope, type ScopeNode } from 'app/api/clients/scope/v0alpha1/endpoints.gen';
import { type RootState } from 'app/store/configureStore';
import { useDispatch, useSelector } from 'app/types/store';

/**
 * Fetches scopes by their IDs and returns a map from ID to Scope.
 * Uses RTK Query cache — recently applied scopes are typically already cached.
 */
export function useScopesById(names: string[]): Record<string, Scope | undefined> {
  const dispatch = useDispatch();
  const namesKey = [...names].sort().join(',');

  useEffect(() => {
    if (names.length === 0) {
      return;
    }
    const subscriptions = names.map((name) => dispatch(scopeAPIv0alpha1.endpoints.getScope.initiate({ name })));
    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, namesKey]);

  const selector = useMemo(
    () => (state: RootState) => {
      const record: Record<string, Scope | undefined> = {};
      for (const name of names) {
        record[name] = scopeAPIv0alpha1.endpoints.getScope.select({ name })(state).data;
      }
      return record;
    },
    // namesKey is a stable string representation of names; recreate selector only when the set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namesKey]
  );

  return useSelector(selector, shallowEqual);
}

/**
 * Fetches scope nodes by their names and returns a map from name to ScopeNode.
 * Used for fetching parent node titles for display in recent scopes.
 */
export function useScopeNodesByName(names: string[]): Record<string, ScopeNode | undefined> {
  const dispatch = useDispatch();
  const namesKey = [...names].sort().join(',');

  useEffect(() => {
    if (names.length === 0) {
      return;
    }
    const subscriptions = names.map((name) => dispatch(scopeAPIv0alpha1.endpoints.getScopeNode.initiate({ name })));
    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, namesKey]);

  const selector = useMemo(
    () => (state: RootState) => {
      const record: Record<string, ScopeNode | undefined> = {};
      for (const name of names) {
        record[name] = scopeAPIv0alpha1.endpoints.getScopeNode.select({ name })(state).data;
      }
      return record;
    },
    // namesKey is a stable string representation of names; recreate selector only when the set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namesKey]
  );

  return useSelector(selector, shallowEqual);
}
