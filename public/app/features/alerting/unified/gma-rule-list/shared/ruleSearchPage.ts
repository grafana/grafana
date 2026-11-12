import {
  type BaseQueryApi,
  type BaseQueryFn,
  type QueryReturnValue,
  type TypedUseInfiniteQueryHookResult,
} from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';
import * as z from 'zod';

import { generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type ResultTotal } from '../rule-row/ResultCount';
import { membershipSearchArg, toMembershipEntries } from '../rule-sequences/ruleSequenceMembership';

import { type PagedFailure } from './PagedFailureAlert';
import { type RuleKind } from './ruleKind';

export interface RuleSearchPage<Hit> {
  hits: Hit[];
  continueToken?: string;
  total?: ResultTotal;
}

/**
 * The page search's queryFn: sends the generated search for one page and parses the response, then caches each
 * rule's sequence membership before it returns.
 */
export async function fetchRuleSearchPage<Hit extends { uid: string }>({
  kind,
  request,
  itemSchema,
  dispatch,
}: {
  kind: RuleKind;
  request: PromiseLike<{ data?: unknown; error?: unknown }>;
  itemSchema: z.ZodType<Hit>;
  dispatch: BaseQueryApi['dispatch'];
}): Promise<QueryReturnValue<RuleSearchPage<Hit>, unknown, undefined>> {
  const response = await request;
  if (response.error) {
    return { error: response.error };
  }
  // A response that fails the schema becomes a query error, so the page shows it with Retry.
  const parsed = ruleSearchPageSchema(itemSchema).safeParse(response.data);
  if (!parsed.success) {
    return { error: { message: parsed.error.message } };
  }

  // Before returning, so the rows mount with their membership already cached.
  const uids = parsed.data.hits.map((hit) => hit.uid);
  if (uids.length > 0) {
    // forceRefetch: a page refetch must not reuse an earlier answer for the same rules.
    const sequences = await dispatch(
      generatedAPI.endpoints.listRuleSequenceSearchV0Alpha1.initiate(membershipSearchArg(kind, uids), {
        subscribe: false,
        forceRefetch: true,
      })
    );
    dispatch(generatedAPI.util.upsertQueryEntries(toMembershipEntries(kind, uids, sequences.data)));
  }
  return { data: parsed.data };
}

type RuleSearchInfiniteQuery<Hit, Filter> = TypedUseInfiniteQueryHookResult<
  RuleSearchPage<Hit>,
  Filter,
  string | undefined,
  BaseQueryFn
>;

/** What the list views read from a page search's infinite query. */
export function useRuleSearchResult<Hit, Filter>(query: RuleSearchInfiniteQuery<Hit, Filter>) {
  const { currentData, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  // Missing from the result type of a query that has not started.
  const isFetchNextPageError = 'isFetchNextPageError' in query && query.isFetchNextPageError;

  // currentData, not data: while the arguments change, data still holds the previous arguments' pages.
  const pages = currentData?.pages;
  const items = useMemo(() => pages?.flatMap((page) => page.hits) ?? [], [pages]);
  const hasLoaded = pages !== undefined;
  const failure: PagedFailure | undefined =
    hasLoaded && isError ? { kind: isFetchNextPageError ? 'load-more' : 'refresh', error } : undefined;

  return {
    items,
    isLoading: !hasLoaded && !isError,
    // A failed first page replaces the list; a later failure keeps the loaded rows and shows `failure` below them.
    error: !hasLoaded && isError ? error : undefined,
    failure,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore: () => {
      void fetchNextPage();
    },
    // Refetching reloads every loaded page with fresh continuation tokens, so it also recovers from an expired one.
    retry: () => {
      void refetch();
    },
    // Only the first page's total counts; later pages repeat it and the count never drives paging.
    total: pages?.[0]?.total,
  };
}

// Only what the list reads. The total is optional to show, so a bad one hides the count instead of failing the page.
function ruleSearchPageSchema<Hit>(itemSchema: z.ZodType<Hit>) {
  return z
    .object({
      items: z.array(itemSchema),
      metadata: z.object({
        continue: z.string().optional(),
        totalHits: z.number().optional().catch(undefined),
        totalHitsRelation: z.string().optional().catch(undefined),
      }),
    })
    .transform(
      ({ items, metadata: { continue: continueToken, totalHits, totalHitsRelation } }): RuleSearchPage<Hit> => ({
        hits: items,
        continueToken,
        total: totalHits === undefined ? undefined : { count: totalHits, isLowerBound: totalHitsRelation === 'lte' },
      })
    );
}
