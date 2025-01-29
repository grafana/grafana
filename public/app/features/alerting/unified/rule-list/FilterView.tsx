import { take, tap, withAbort } from 'ix/asynciterable/operators';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Card, EmptyState, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { isLoading, useAsync } from '../hooks/useAsync';
import { RulesFilter } from '../search/rulesSearchParser';
import { hashRule } from '../utils/rule-id';

import { DataSourceRuleLoader } from './DataSourceRuleLoader';
import { GrafanaRuleLoader } from './GrafanaRuleLoader';
import LoadMoreHelper from './LoadMoreHelper';
import { UnknownRuleListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemLoader } from './components/AlertRuleListItemLoader';
import {
  GrafanaRuleWithOrigin,
  PromRuleWithOrigin,
  RuleWithOrigin,
  useFilteredRulesIteratorProvider,
} from './hooks/useFilteredRulesIterator';

interface FilterViewProps {
  filterState: RulesFilter;
}

const FRONTENT_PAGE_SIZE = 100;
const API_PAGE_SIZE = 2000;

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
  const { getFilteredRulesIterator } = useFilteredRulesIteratorProvider();

  /* this is the abort controller that allows us to stop an AsyncIterable */
  const controller = useRef(new AbortController());

  /**
   * This an iterator that we can use to populate the search results.
   * It also uses the signal from the AbortController above to cancel retrieving more results and sets up a
   * callback function to detect when we've exhausted the source.
   * This is the main AsyncIterable<RuleWithOrigin> we will use for the search results */
  const rulesIterator = useRef(
    getFilteredRulesIterator(filterState, API_PAGE_SIZE).pipe(
      withAbort(controller.current.signal),
      onFinished(() => setDoneSearching(true))
    )
  );

  const [rules, setRules] = useState<KeyedRuleWithOrigin[]>([]);
  const [doneSearching, setDoneSearching] = useState(false);

  /* This function will fetch a page of results from the iterable */
  const [{ execute: loadResultPage }, state] = useAsync(async () => {
    for await (const rule of rulesIterator.current.pipe(take(FRONTENT_PAGE_SIZE))) {
      startTransition(() => {
        // Rule key could be computed on the fly, but we do it here to avoid recalculating it with each render
        // It's a not trivial computation because it involves hashing the rule
        setRules((rules) => rules.concat({ key: getRuleKey(rule), ...rule }));
      });
    }
  });

  /* When we unmount the component we make sure to abort all iterables */
  useEffect(() => {
    const currentAbortController = controller.current;

    return () => {
      currentAbortController.abort();
    };
  }, [controller]);

  const loading = isLoading(state) || transitionPending;
  const numberOfRules = rules.length;
  const noRulesFound = numberOfRules === 0 && !loading;

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
      <ul aria-label="filtered-rule-list">
        {rules.map((ruleWithOrigin) => {
          const { key, rule, groupIdentifier, origin } = ruleWithOrigin;

          switch (origin) {
            case 'grafana':
              return (
                <GrafanaRuleLoader
                  key={key}
                  rule={rule}
                  groupIdentifier={groupIdentifier}
                  namespaceName={ruleWithOrigin.namespaceName}
                />
              );
            case 'datasource':
              return <DataSourceRuleLoader key={key} rule={rule} groupIdentifier={groupIdentifier} />;
            default:
              return <UnknownRuleListItem key={key} rule={rule} groupIdentifier={groupIdentifier} />;
          }
        })}
        {loading && (
          <>
            <AlertRuleListItemLoader />
            <AlertRuleListItemLoader />
          </>
        )}
      </ul>
      {doneSearching && !noRulesFound && (
        <Card>
          <Text color="secondary">
            <Trans i18nKey="alerting.rule-list.filter-view.no-more-results">
              No more results – showing {{ numberOfRules }} rules
            </Trans>
          </Text>
        </Card>
      )}
      {!doneSearching && !loading && <LoadMoreHelper handleLoad={loadResultPage} />}
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
