import { useEffect } from 'react';
import { shallowEqual } from 'react-redux';

import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { type Scope, type ScopeNode } from 'app/api/clients/scope/v0alpha1/endpoints.gen';
import { useDispatch, useSelector } from 'app/types/store';

/**
 * Fetches scopes by their IDs and returns a map from ID to Scope.
 * Uses RTK Query cache — recently applied scopes are typically already cached.
 */
export function useScopesById(names: string[]): Record<string, Scope | undefined> {
  const dispatch = useDispatch();
  const namesKey = names.join(',');

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

  return useSelector((state) => {
    const record: Record<string, Scope | undefined> = {};
    for (const name of names) {
      const result = scopeAPIv0alpha1.endpoints.getScope.select({ name })(state);
      record[name] = result.data;
    }
    return record;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, shallowEqual);
}

/**
 * Fetches scope nodes by their names and returns a map from name to ScopeNode.
 * Used for fetching parent node titles for display in recent scopes.
 */
export function useScopeNodesByName(names: string[]): Record<string, ScopeNode | undefined> {
  const dispatch = useDispatch();
  const namesKey = names.join(',');

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

  return useSelector((state) => {
    const record: Record<string, ScopeNode | undefined> = {};
    for (const name of names) {
      const result = scopeAPIv0alpha1.endpoints.getScopeNode.select({ name })(state);
      record[name] = result.data;
    }
    return record;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, shallowEqual);
}
