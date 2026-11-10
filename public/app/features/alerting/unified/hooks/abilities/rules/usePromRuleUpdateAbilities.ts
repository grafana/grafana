import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY,
  type Observable,
  Subject,
  catchError,
  defer,
  filter,
  map,
  mergeAll,
  of,
  retry,
  takeUntil,
  tap,
  throwError,
  timer,
} from 'rxjs';

import { getAppPluginEnabled, isFetchError } from '@grafana/runtime';
import { getFolderByUidFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { type FolderDTO } from 'app/types/folders';
import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { getRulePluginOrigin } from '../../../utils/rules';
import { type AsyncAbility } from '../types';

import { computePromRuleUpdateAbility, getGrafanaRuleFolderPermissions } from './ruleAbilities.utils';

const REQUEST_CONCURRENCY = 4;
const REQUEST_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

type DependencyResult =
  | { kind: 'folder'; folder: FolderDTO }
  | { kind: 'plugin'; enabled: boolean }
  | { kind: 'failed' };

function isPermanentError(error: unknown): boolean {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  return (
    isFetchError(cause) && cause.status >= 400 && cause.status < 500 && cause.status !== 408 && cause.status !== 429
  );
}

/** Resolves update abilities for all candidates, independently of rendered rule cards. */
export function usePromRuleUpdateAbilities(
  rules: GrafanaPromRuleDTO[],
  enabled: boolean
): ReadonlyMap<string, AsyncAbility> {
  const [dependencies, setDependencies] = useState<ReadonlyMap<string, DependencyResult>>(() => new Map());
  const cached = useRef(new Map<string, DependencyResult>());
  const reads = useMemo(() => new Subject<Observable<{ key: string; result: DependencyResult }>>(), []);
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

  useEffect(() => {
    const subscription = reads.pipe(mergeAll(REQUEST_CONCURRENCY)).subscribe(({ key, result }) => {
      setDependencies((current) => new Map(current).set(key, result));
    });
    return () => subscription.unsubscribe();
  }, [reads]);

  useEffect(() => {
    let disposed = false;
    const cancelled = new Subject<void>();
    const requested: string[] = JSON.parse(keys);
    for (const key of requested.filter((key) => enabled && !cached.current.has(key))) {
      reads.next(
        defer(() =>
          disposed
            ? EMPTY
            : defer(async (): Promise<DependencyResult> => {
                if (key.startsWith('folder:')) {
                  return { kind: 'folder', folder: await getFolderByUidFacade(key.slice('folder:'.length)) };
                }
                return { kind: 'plugin', enabled: await getAppPluginEnabled(key.slice('plugin:'.length)) };
              })
        ).pipe(
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
          tap((result) => {
            if (!disposed) {
              cached.current.set(key, result);
            }
          }),
          catchError((error: unknown) => {
            const result: DependencyResult = { kind: 'failed' };
            if (!disposed && isPermanentError(error)) {
              cached.current.set(key, result);
            }
            return of(result);
          }),
          filter(() => !disposed),
          map((result) => ({ key, result }))
        )
      );
    }
    return () => {
      disposed = true;
      cancelled.next();
      cancelled.complete();
    };
  }, [keys, enabled, reads]);

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
          loading: Boolean((rule.folderUid && !folder) || (pluginId && !plugin)),
          lookupFailed: folder?.kind === 'failed' || plugin?.kind === 'failed',
          canEdit: getGrafanaRuleFolderPermissions(folder?.kind === 'folder' ? folder.folder : undefined).canEdit,
          isPluginManaged: plugin?.kind === 'plugin' && plugin.enabled,
        })
      );
    }
    return abilities;
  }, [rules, enabled, dependencies]);
}
