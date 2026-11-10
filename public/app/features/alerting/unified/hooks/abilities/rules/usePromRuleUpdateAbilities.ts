import { createSelector } from '@reduxjs/toolkit';
import { useEffect, useMemo } from 'react';
import { EMPTY, type Observable, Subject, catchError, defer, mergeAll } from 'rxjs';

import { useFlagFoldersAppPlatformAPI } from '@grafana/runtime/internal';
import { PERMISSION_LOOKUP_CONCURRENCY } from 'app/core/utils/permissionLookupQueue';
import { type AppDispatch, type RootState } from 'app/store/configureStore';
import { type FolderDTO } from 'app/types/folders';
import { useDispatch, useSelector } from 'app/types/store';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import {
  legacyRuleFolderPermissionsApi,
  ruleFolderPermissionsApi,
  ruleUpdateDependenciesApi,
} from '../../../api/ruleUpdateDependenciesApi';
import { getRulePluginOrigin } from '../../../utils/rules';
import { type AsyncAbility } from '../types';

import { computePromRuleUpdateAbility, getGrafanaRuleFolderPermissions } from './ruleAbilities.utils';

interface DependencyState {
  loading: boolean;
  failed: boolean;
  canEdit?: boolean;
  isPluginManaged?: boolean;
}

interface QuerySubscription {
  unwrap(): Promise<unknown>;
  unsubscribe(): void;
}

interface DependencyQuery {
  key: string;
  select(state: RootState): DependencyState;
  subscribe(dispatch: AppDispatch): QuerySubscription;
}

function folderState(result: {
  isUninitialized: boolean;
  isLoading: boolean;
  isError: boolean;
  data?: Pick<FolderDTO, 'accessControl'>;
}): DependencyState {
  return {
    loading: result.isUninitialized || result.isLoading,
    failed: result.isError,
    canEdit: getGrafanaRuleFolderPermissions(result.data).canEdit,
  };
}

function folderQuery(uid: string, appPlatform: boolean): DependencyQuery {
  const key = `folder:${uid}`;
  if (appPlatform) {
    const endpoint = ruleFolderPermissionsApi.endpoints.getBulkRuleFolderPermissions;
    return {
      key,
      select: createSelector(endpoint.select(uid), folderState),
      subscribe: (dispatch) => dispatch(endpoint.initiate(uid)),
    };
  }
  const endpoint = legacyRuleFolderPermissionsApi.endpoints.getBulkRuleFolderPermissions;
  return {
    key,
    select: createSelector(endpoint.select(uid), folderState),
    subscribe: (dispatch) => dispatch(endpoint.initiate(uid)),
  };
}

function pluginQuery(id: string): DependencyQuery {
  return {
    key: `plugin:${id}`,
    select: createSelector(ruleUpdateDependenciesApi.endpoints.getRulePluginEnabled.select(id), (result) => ({
      loading: result.isUninitialized || result.isLoading,
      failed: result.isError,
      isPluginManaged: result.data === true,
    })),
    subscribe: (dispatch) => dispatch(ruleUpdateDependenciesApi.endpoints.getRulePluginEnabled.initiate(id)),
  };
}

/** Subscribes to bulk dependency queries independently of rendered rule cards. */
export function usePromRuleUpdateAbilities(
  rules: GrafanaPromRuleDTO[],
  enabled: boolean
): ReadonlyMap<string, AsyncAbility> {
  const dispatch = useDispatch();
  const appPlatform = useFlagFoldersAppPlatformAPI();
  const reads = useMemo(() => new Subject<Observable<unknown>>(), []);
  const keys = JSON.stringify(
    [
      ...new Set(
        rules.flatMap((rule) => {
          const plugin = getRulePluginOrigin(rule);
          return [
            ...(rule.folderUid ? [`folder:${rule.folderUid}`] : []),
            ...(plugin ? [`plugin:${plugin.pluginId}`] : []),
          ];
        })
      ),
    ].sort()
  );
  const queries = useMemo(() => {
    const requested: string[] = enabled ? JSON.parse(keys) : [];
    return requested.map((key) =>
      key.startsWith('folder:')
        ? folderQuery(key.slice('folder:'.length), appPlatform)
        : pluginQuery(key.slice('plugin:'.length))
    );
  }, [keys, enabled, appPlatform]);
  const selectDependencies = useMemo(
    () =>
      createSelector(
        queries.map(({ select }) => select),
        (...states) => new Map(queries.map(({ key }, index) => [key, states[index]]))
      ),
    [queries]
  );
  const dependencies = useSelector(selectDependencies);

  useEffect(() => {
    const subscription = reads.pipe(mergeAll(PERMISSION_LOOKUP_CONCURRENCY)).subscribe();
    return () => subscription.unsubscribe();
  }, [reads]);

  useEffect(() => {
    let disposed = false;
    const subscriptions: QuerySubscription[] = [];
    for (const query of queries) {
      reads.next(
        defer(() => {
          if (disposed) {
            return EMPTY;
          }
          const subscription = query.subscribe(dispatch);
          subscriptions.push(subscription);
          return subscription.unwrap();
        }).pipe(
          // Query errors stay observable in Redux without stopping the subscription queue.
          catchError(() => EMPTY)
        )
      );
    }
    return () => {
      disposed = true;
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    };
  }, [queries, dispatch, reads]);

  return useMemo(() => {
    const abilities = new Map<string, AsyncAbility>();
    if (!enabled) {
      return abilities;
    }
    for (const rule of rules) {
      const pluginId = getRulePluginOrigin(rule)?.pluginId;
      const folder = dependencies.get(`folder:${rule.folderUid}`);
      const plugin = pluginId ? dependencies.get(`plugin:${pluginId}`) : undefined;
      abilities.set(
        rule.uid,
        computePromRuleUpdateAbility(rule, {
          loading: Boolean(
            (rule.folderUid && (!folder || folder.loading)) || (pluginId && (!plugin || plugin.loading))
          ),
          lookupFailed: folder?.failed === true || plugin?.failed === true,
          canEdit: folder?.canEdit === true,
          isPluginManaged: plugin?.isPluginManaged === true,
        })
      );
    }
    return abilities;
  }, [rules, enabled, dependencies]);
}
