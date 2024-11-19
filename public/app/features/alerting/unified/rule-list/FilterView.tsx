import { take, tap, withAbort } from 'ix/asynciterable/operators';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useDeepCompareEffect } from 'react-use';

import { Card, EmptyState, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { isLoading, useAsync } from '../hooks/useAsync';
import { RulesFilter } from '../search/rulesSearchParser';

import LoadMoreHelper from './LoadMoreHelper';
import { AlertRuleLoader } from './RuleList.v2';
import { ListItem } from './components/ListItem';
import { ActionsLoader } from './components/RuleActionsButtons.V2';
import { RuleListIcon } from './components/RuleListIcon';
import { RuleWithOrigin, useFilteredRulesIteratorProvider } from './hooks/useFilteredRulesIterator';

interface FilterViewProps {
  filterState: RulesFilter;
}

const FRONTENT_PAGE_SIZE = 100;
const API_PAGE_SIZE = 2000;

export function FilterView({ filterState }: FilterViewProps) {
  const [transitionPending, startTransition] = useTransition();

  /* this hook returns a function that creates an AsyncIterable<RuleWithOrigin> which we will use to populate the front-end */
  const { getFilteredRulesIterator } = useFilteredRulesIteratorProvider(filterState, API_PAGE_SIZE);

  /* this is the abort controller that allows us to stop an AsyncIterable */
  const controller = useRef(new AbortController());

  /**
   * This function returs a iterator that we can use to populate the search results.
   * It also uses the signal from the AbortController above to cancel retrieving more results and sets up a
   * callback function to detect when we've exhausted the source.
   */
  const createNewIterator = useCallback(
    () =>
      getFilteredRulesIterator().pipe(
        withAbort(controller.current.signal),
        onFinished(() => setDoneSearching(true))
      ),
    [getFilteredRulesIterator]
  );

  /* This is the main AsyncIterable<RuleWithOrigin> we will use for the search results */
  const rulesIterator = useRef(createNewIterator());

  const [rules, setRules] = useState<RuleWithOrigin[]>([]);
  const [doneSearching, setDoneSearching] = useState(false);

  /* This function will fetch a page of results from the iterable */
  const [{ execute: loadResultPage }, state] = useAsync(async () => {
    for await (const rule of rulesIterator.current.pipe(take(FRONTENT_PAGE_SIZE))) {
      startTransition(() => {
        setRules((rules) => rules.concat(rule));
      });
    }
  });

  /**
   * When the filter state is updated, reset the AbortController and re-create the iterator.
   * Then reset the state of the component
   */
  useDeepCompareEffect(() => {
    // recreate abort controller
    controller.current.abort();
    controller.current = new AbortController();

    // recreate rules iterator
    rulesIterator.current = createNewIterator();

    // reset view state
    setRules([]);
    setDoneSearching(false);

    // fetch a new page
    loadResultPage();
  }, [filterState]);

  /* When we unmount the component we make sure to abort all iterables */
  useEffect(() => {
    return () => {
      controller.current.abort();
    };
  }, [controller]);

  const loading = isLoading(state) || transitionPending;
  const numberOfRules = rules.length;
  const noRulesFound = numberOfRules === 0 && !loading;

  /* If we don't have any rules and have exhausted all sources, show a EmptyState */
  if (noRulesFound && doneSearching) {
    return (
      <EmptyState variant="not-found" message="No matching rules found">
        No alert- or recording rules matched your current set of filters.
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={0}>
      {rules.map(({ ruleKey, rule, groupIdentifier }) => (
        <AlertRuleLoader key={ruleKey} rule={rule} groupIdentifier={groupIdentifier} />
      ))}
      {loading && (
        <>
          <AlertRuleListItemLoader />
          <AlertRuleListItemLoader />
        </>
      )}
      {doneSearching && !noRulesFound && (
        <Card>
          <Text color="secondary">
            <Trans i18nKey="alerting.rule-list.filter-view.no-more-results">
              No more results – showing {{ numberOfRules }} rules
            </Trans>
          </Text>
        </Card>
      )}
      {!doneSearching && <LoadMoreHelper handleLoad={loadResultPage} />}
    </Stack>
  );
}

const AlertRuleListItemLoader = () => (
  <ListItem
    title={<Skeleton width={64} />}
    icon={<RuleListIcon isPaused={false} />}
    description={<Skeleton width={256} />}
    actions={<ActionsLoader />}
  />
);

// simple helper function to detect the end of the source async iterable
function onFinished<T>(fn: () => void) {
  return tap<T>(undefined, undefined, fn);
}
