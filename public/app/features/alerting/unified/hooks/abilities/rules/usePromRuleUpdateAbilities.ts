import { createSelector } from '@reduxjs/toolkit';
import { useEffect, useMemo } from 'react';
import {
  EMPTY,
  type Observable,
  Subject,
  catchError,
  defer,
  mergeAll,
  retry,
  takeUntil,
  throwError,
  timer,
} from 'rxjs';

import { isFetchError } from '@grafana/runtime';
import { useFlagFoldersAppPlatformAPI } from '@grafana/runtime/internal';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { PERMISSION_LOOKUP_CONCURRENCY } from 'app/core/utils/permissionLookupQueue';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { type AppDispatch, type RootState } from 'app/store/configureStore';
import { type FolderDTO } from 'app/types/folders';
import { useDispatch, useSelector } from 'app/types/store';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { ruleUpdateDependenciesApi } from '../../../api/ruleUpdateDependenciesApi';
import { getRulePluginOrigin } from '../../../utils/rules';
import { type AsyncAbility } from '../types';

import { computePromRuleUpdateAbility, getGrafanaRuleFolderPermissions } from './ruleAbilities.utils';

const REQUEST_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

interface DependencyState {
  loading: boolean;
  failed: boolean;
  canEdit?: boolean;
  isPluginManaged?: boolean;
}

interface QuerySubscription {
  unwrap(): Promise<unknown>;
  refetch(): QuerySubscription;
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
    const args = { name: uid };
    return {
      key,
      select: createSelector(folderAPIv1beta1.endpoints.getFolderAccess.select(args), folderState),
      subscribe: (dispatch) => dispatch(folderAPIv1beta1.endpoints.getFolderAccess.initiate(args)),
    };
  }
  const args = { folderUID: uid, accesscontrol: true, isLegacyCall: false };
  return {
    key,
    select: createSelector(browseDashboardsAPI.endpoints.getFolder.select(args), folderState),
    subscribe: (dispatch) => dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(args)),
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

function isPermanentError(error: unknown): boolean {
  return (
    isFetchError(error) && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
  );
}

/** Subscribes to canonical dependency queries independently of rendered rule cards. */
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
    const cancelled = new Subject<void>();
    const subscriptions: QuerySubscription[] = [];
    for (const query of queries) {
      let subscription: QuerySubscription | undefined;
      reads.next(
        defer(() => {
          if (disposed) {
            return EMPTY;
          }
          if (subscription) {
            return subscription.refetch().unwrap();
          }
          subscription = query.subscribe(dispatch);
          subscriptions.push(subscription);
          return subscription.unwrap();
        }).pipe(
          retry({
            count: REQUEST_ATTEMPTS - 1,
            delay: (error) => {
              if (disposed) {
                return EMPTY;
              }
              if (isPermanentError(error)) {
                return throwError(() => error);
              }
              return timer(RETRY_DELAY_MS).pipe(takeUntil(cancelled));
            },
          }),
          // Query errors stay observable in Redux without stopping the subscription queue.
          catchError(() => EMPTY)
        )
      );
    }
    return () => {
      disposed = true;
      cancelled.next();
      cancelled.complete();
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
