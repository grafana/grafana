import { bufferCountOrTime, tap } from 'ix/asynciterable/operators';
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useUnmount } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { EmptyState, Stack } from '@grafana/ui';

import { withPerformanceLogging } from '../Analytics';
import { isLoading, useAsync } from '../hooks/useAsync';
import { RulesFilter } from '../search/rulesSearchParser';
import { hashRule } from '../utils/rule-id';

import { DataSourceRuleLoader } from './DataSourceRuleLoader';
import { FilterProgressState, FilterStatus } from './FilterViewStatus';
import { GrafanaRuleListItem } from './GrafanaRuleListItem';
import LoadMoreHelper from './LoadMoreHelper';
import { UnknownRuleListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';
import {
  GrafanaRuleWithOrigin,
  PromRuleWithOrigin,
  RuleWithOrigin,
  useFilteredRulesIteratorProvider,
} from './hooks/useFilteredRulesIterator';
import { FRONTEND_LIST_PAGE_SIZE, getApiGroupPageSize } from './paginationLimits';

interface FilterViewProps {
  filterState: RulesFilter;
}

export function FilterView({ filterState }: FilterViewProps) {
  // ⚠️ We use a key to force the component to unmount and remount when the filter state changes
  // filterState is a complex object including arrays and is constructed from URL params
  // so even for the same params we get a new object or new properties in it
  return <FilterViewResults filterState={filterState} key={JSON.stringify(filterState)} />;
}

type KeyedRuleWithOrigin = RuleWithOrigin & {
  /**
   * Artificial frontend-only identifier for the rule.
   * It's used as a key for the rule in the rule list to prevent key duplication
   */
  key: string;
};

/**
 * Renders the list of rules that match the filter.
 * It doesn't update results when the filter changes, use key property to force a remount with a new filter
 * Internally it needs to reset rules generator to get new results
 * While a bit counter-intuitive resetting using key simplifies a lot of logic in the component
 * The component implements infinite scrolling. It loads next page when the user scrolls to the bottom of the list
 */
function FilterViewResults({ filterState }: FilterViewProps) {
  const [transitionPending, startTransition] = useTransition();

  /* this hook returns a function that creates an AsyncIterable<RuleWithOrigin> which we will use to populate the front-end */
  const getFilteredRulesIterator = useFilteredRulesIteratorProvider();

  const iteration = useRef<{
    rulesBatchIterator: AsyncIterator<RuleWithOrigin[]>;
    abortController: AbortController;
  } | null>(null);

  const [rules, setRules] = useState<KeyedRuleWithOrigin[]>([]);
  const [doneSearching, setDoneSearching] = useState(false);

  // Lazy initialization of useRef
  // https://18.react.dev/reference/react/useRef#how-to-avoid-null-checks-when-initializing-use-ref-later
  const getRulesBatchIterator = useCallback(() => {
    if (!iteration.current) {
      /**
       * This an iterator that we can use to populate the search results.
       * It also uses the signal from the AbortController above to cancel retrieving more results and sets up a
       * callback function to detect when we've exhausted the source.
       * This is the main AsyncIterable<RuleWithOrigin> we will use for the search results
       *
       * ⚠️ Make sure we are returning / using a "iterator" and not an "iterable" since the iterable is only a blueprint
       * and the iterator will allow us to exhaust the iterable in a stateful way
       */
      const { iterable, abortController } = getFilteredRulesIterator(filterState, getApiGroupPageSize(true));
      const rulesBatchIterator = iterable
        .pipe(
          bufferCountOrTime(FRONTEND_LIST_PAGE_SIZE, 1000),
          onFinished(() => setDoneSearching(true))
        )
        [Symbol.asyncIterator]();
      iteration.current = { rulesBatchIterator: rulesBatchIterator, abortController };
    }
    return iteration.current.rulesBatchIterator;
  }, [filterState, getFilteredRulesIterator]);

  /* This function will fetch a page of results from the iterable */
  const [{ execute: loadResultPage }, state] = useAsync(
    withPerformanceLogging(async () => {
      const rulesIterator = getRulesBatchIterator();

      let loadedRulesCount = 0;

      while (loadedRulesCount < FRONTEND_LIST_PAGE_SIZE) {
        const nextRulesBatch = await rulesIterator.next();
        if (nextRulesBatch.done) {
          return;
        }
        if (nextRulesBatch.value) {
          startTransition(() => {
            setRules((rules) => rules.concat(nextRulesBatch.value.map((rule) => ({ key: getRuleKey(rule), ...rule }))));
          });
        }
        loadedRulesCount += nextRulesBatch.value.length;
      }
    }, 'alerting.rule-list.filter-view.load-result-page')
  );

  const loading = isLoading(state) || transitionPending;
  const numberOfRules = rules.length;
  const noRulesFound = numberOfRules === 0 && !loading;
  const loadingAborted = iteration.current?.abortController.signal.aborted;
  const cancelSearch = useCallback(() => {
    iteration.current?.abortController.abort();
  }, []);

  /* When we unmount the component we make sure to abort all iterables and stop making HTTP requests */
  useUnmount(() => {
    cancelSearch();
  });

  // track the state of the filter progress, which is either searching, done or aborted
  const filterProgressState = useMemo<FilterProgressState>(() => {
    if (loadingAborted) {
      return 'aborted';
    } else if (doneSearching) {
      return 'done';
    }
    return 'searching';
  }, [doneSearching, loadingAborted]);

  /* If we don't have any rules and have exhausted all sources, show a EmptyState */
  if (noRulesFound && doneSearching) {
    return (
      <EmptyState variant="not-found" message="No matching rules found">
        <Trans i18nKey="alerting.rule-list.filter-view.no-rules-found">
          No alert or recording rules matched your current set of filters.
        </Trans>
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={0}>
      <ul aria-label={t('alerting.filter-view-results.aria-label-filteredrulelist', 'filtered-rule-list')}>
        {rules.map((ruleWithOrigin) => {
          const { key, rule, groupIdentifier, origin } = ruleWithOrigin;

          switch (origin) {
            case 'grafana':
              return (
                <GrafanaRuleListItem
                  rule={rule}
                  groupIdentifier={groupIdentifier}
                  namespaceName={ruleWithOrigin.namespaceName}
                  showLocation={true}
                />
              );
            case 'datasource':
              return <DataSourceRuleLoader key={key} rule={rule} groupIdentifier={groupIdentifier} />;
            default:
              return (
                <UnknownRuleListItem
                  key={key}
                  ruleName={t('alerting.rule-list.unknown-rule-type', 'Unknown rule type')}
                  groupIdentifier={groupIdentifier}
                  ruleDefinition={rule}
                />
              );
          }
        })}
        {loading && (
          <>
            <AlertRuleListItemSkeleton />
            <AlertRuleListItemSkeleton />
          </>
        )}
      </ul>
      {!noRulesFound && (
        <FilterStatus state={filterProgressState} numberOfRules={numberOfRules} onCancel={cancelSearch} />
      )}
      {!doneSearching && !loading && !loadingAborted && <LoadMoreHelper handleLoad={loadResultPage} />}
    </Stack>
  );
}

// simple helper function to detect the end of the source async iterable
function onFinished<T>(fn: () => void) {
  return tap<T>(undefined, undefined, fn);
}

function getRuleKey(ruleWithOrigin: RuleWithOrigin): string {
  if (ruleWithOrigin.origin === 'grafana') {
    return getGrafanaRuleKey(ruleWithOrigin);
  }
  return getDataSourceRuleKey(ruleWithOrigin);
}

function getGrafanaRuleKey(ruleWithOrigin: GrafanaRuleWithOrigin) {
  const {
    groupIdentifier: { namespace, groupName },
    rule,
  } = ruleWithOrigin;
  return `grafana-${namespace.uid}-${groupName}-${rule.uid}}`;
}

function getDataSourceRuleKey(ruleWithOrigin: PromRuleWithOrigin) {
  const {
    rule,
    groupIdentifier: { rulesSource, namespace, groupName },
  } = ruleWithOrigin;
  return `${rulesSource.name}-${namespace.name}-${groupName}-${rule.name}-${rule.type}-${hashRule(rule)}`;
}
