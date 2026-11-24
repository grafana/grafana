import { type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { type BaseQueryApi, type BaseQueryFn, type QueryReturnValue } from '@reduxjs/toolkit/query';
import { type TypedUseInfiniteQueryHookResult } from '@reduxjs/toolkit/query/react';
import { useCallback, useState } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isFetchError } from '@grafana/runtime';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type PagedFailure } from '../shared/PagedFailureAlert';

export type DeletedRule = AlertRule | RecordingRule;

export interface RestoreResult {
  success: boolean;
  isConflict: boolean;
  error?: unknown;
}

export interface RuleRestorer<Rule extends DeletedRule> {
  restore: (rule: Rule) => Promise<RestoreResult>;
  isRestoring: boolean;
}

export function toRestoreResult(result: { data: unknown } | { error: unknown }): RestoreResult {
  if ('error' in result) {
    const isConflict = isFetchError(result.error) && result.error.status === 409;
    return { success: false, isConflict, error: result.error };
  }
  return { success: true, isConflict: false };
}

const TRASH_LABEL_SELECTOR = 'grafana.app/get-trash=true';
const PAGE_SIZE = DEFAULT_PER_PAGE_PAGINATION;

type GeneratedListRequest<Rule> = ThunkAction<
  PromiseLike<{
    data?: { items: Rule[]; metadata?: { continue?: string } };
    error?: unknown;
  }>,
  unknown,
  unknown,
  UnknownAction
>;

interface GeneratedList<Rule> {
  initiate: (
    arg: { labelSelector?: string; limit?: number; continue?: string },
    options: { subscribe: boolean; forceRefetch: boolean }
  ) => GeneratedListRequest<Rule>;
}

export function deletedRulesPageQueryFn<Rule>(list: GeneratedList<Rule>) {
  return async (
    { pageParam }: { pageParam: string | undefined },
    { dispatch }: BaseQueryApi
  ): Promise<QueryReturnValue<{ items: Rule[]; continueToken?: string }, unknown, undefined>> => {
    const response = await dispatch(
      list.initiate(
        { labelSelector: TRASH_LABEL_SELECTOR, limit: PAGE_SIZE, continue: pageParam },
        { subscribe: false, forceRefetch: true }
      )
    );
    if (response.error) {
      return { error: response.error };
    }
    return {
      data: {
        items: response.data?.items ?? [],
        continueToken: response.data?.metadata?.continue,
      },
    };
  };
}

type TrashInfiniteQuery<Rule> = TypedUseInfiniteQueryHookResult<
  { items: Rule[]; continueToken?: string },
  void,
  string | undefined,
  BaseQueryFn
>;

export interface UseDeletedRulesResult<Rule> {
  items: Rule[];
  hasMore: boolean;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: unknown;
  /** Set when a later page failed; the loaded rows stay and the failure shows below them. */
  failure: PagedFailure | undefined;
  /** Total items returned by the API (all pages combined) — use for analytics, not display. */
  totalFromApi: number | undefined;
  loadMore: () => void;
  retry: () => void;
  refetch: () => void;
}

/**
 * Shared pagination hook for trash infinite queries. Applies 40-row local chunking
 * because legacy storage ignores `limit` and returns all tombstones at once.
 */
export function useDeletedRulesResult<Rule>(query: TrashInfiniteQuery<Rule>): UseDeletedRulesResult<Rule> {
  const [revealed, setRevealed] = useState(PAGE_SIZE);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  // Missing from the result type of a query that has not started.
  const isFetchNextPageError = 'isFetchNextPageError' in query && query.isFetchNextPageError;

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];
  const items = allItems.slice(0, revealed);
  const hasMore = revealed < allItems.length || hasNextPage;
  const failure: PagedFailure | undefined =
    data && isError ? { kind: isFetchNextPageError ? 'load-more' : 'refresh', error } : undefined;

  const loadMore = useCallback(() => {
    if (revealed >= allItems.length) {
      void fetchNextPage();
    }
    setRevealed((r) => r + PAGE_SIZE);
  }, [revealed, allItems.length, fetchNextPage]);

  const handleRefetch = useCallback(() => {
    setRevealed(PAGE_SIZE);
    void refetch();
  }, [refetch]);

  return {
    items,
    hasMore,
    isLoading,
    isFetchingMore: isFetchingNextPage,
    // A failed first page replaces the list; a later failure keeps the loaded rows and shows `failure` below them.
    error: !data && isError ? error : undefined,
    failure,
    totalFromApi: data ? allItems.length : undefined,
    loadMore,
    // Refetching reloads every loaded page with fresh continue tokens, so it also recovers from an expired one.
    retry: () => {
      void refetch();
    },
    refetch: handleRefetch,
  };
}
