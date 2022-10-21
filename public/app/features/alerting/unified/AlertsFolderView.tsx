import { css } from '@emotion/css';
import { isEqual, orderBy, uniqWith } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Card, FilterInput, Icon, Pagination, Select, TagList, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { getQueryParamValue } from 'app/core/utils/query';
import { FolderState, useDispatch } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { usePagination } from './hooks/usePagination';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchPromRulesAction, fetchRulerRulesAction } from './state/actions';
import { labelsMatchMatchers, matchersToString, parseMatcher, parseMatchers } from './utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { createViewLink } from './utils/misc';

interface Props {
  folder: FolderState;
}

enum SortOrder {
  Ascending = 'alpha-asc',
  Descending = 'alpha-desc',
}

const sortOptions: Array<SelectableValue<SortOrder>> = [
  { label: 'Alphabetically [A-Z]', value: SortOrder.Ascending },
  { label: 'Alphabetically [Z-A]', value: SortOrder.Descending },
];

export const AlertsFolderView = ({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const onTagClick = (tagName: string) => {
    const matchers = parseMatchers(labelFilter);
    const tagMatcherField = parseMatcher(tagName);
    const uniqueMatchers = uniqWith([...matchers, tagMatcherField], isEqual);
    const matchersString = matchersToString(uniqueMatchers);
    setLabelFilter(matchersString);
  };

  useEffect(() => {
    dispatch(fetchPromRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
    dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
  }, [dispatch]);

  const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const { nameFilter, labelFilter, sortOrder, setNameFilter, setLabelFilter, setSortOrder } =
    useAlertsFolderViewParams();

  const matchingNamespace = combinedNamespaces.find((namespace) => namespace.name === folder.title);
  const alertRules = matchingNamespace?.groups.flatMap((group) => group.rules) ?? [];

  const filteredRules = filterAndSortRules(alertRules, nameFilter, labelFilter, sortOrder ?? SortOrder.Ascending);

  const hasNoResults = alertRules.length === 0 || filteredRules.length === 0;
  const { page, numberOfPages, onPageChange, pageItems } = usePagination(filteredRules, 1, DEFAULT_PER_PAGE_PAGINATION);

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={3}>
        <FilterInput
          value={nameFilter}
          onChange={setNameFilter}
          placeholder="Search alert rules by name"
          data-testid="name-filter"
        />
        <Stack direction="row">
          <Select<SortOrder>
            value={sortOrder}
            onChange={({ value }) => value && setSortOrder(value)}
            options={sortOptions}
            width={25}
            aria-label="Sort"
            placeholder={`Sort (Default A-Z)`}
            prefix={<Icon name={sortOrder === SortOrder.Ascending ? 'sort-amount-up' : 'sort-amount-down'} />}
          />
          <FilterInput
            value={labelFilter}
            onChange={setLabelFilter}
            placeholder="Search alerts by labels"
            className={styles.filterLabelsInput}
            data-testid="label-filter"
          />
        </Stack>

        <Stack gap={1}>
          {pageItems.map((currentRule) => (
            <Card
              key={currentRule.name}
              href={createViewLink('grafana', currentRule, '')}
              className={styles.card}
              data-testid="alert-card-row"
            >
              <Card.Heading>{currentRule.name}</Card.Heading>
              <Card.Tags>
                <TagList
                  onClick={onTagClick}
                  tags={Object.entries(currentRule.labels).map(([label, value]) => `${label}=${value}`)}
                />
              </Card.Tags>
              <Card.Meta>
                <div>
                  <Icon name="folder" /> {folder.title}
                </div>
              </Card.Meta>
            </Card>
          ))}
        </Stack>
        {hasNoResults && <div className={styles.noResults}>No alert rules found</div>}
        <div className={styles.pagination}>
          <Pagination
            currentPage={page}
            numberOfPages={numberOfPages}
            onNavigate={onPageChange}
            hideWhenSinglePage={true}
          />
        </div>
      </Stack>
    </div>
  );
};

enum AlertFolderViewParams {
  nameFilter = 'nameFilter',
  labelFilter = 'labelFilter',
  sortOrder = 'sort',
}

function useAlertsFolderViewParams() {
  const [searchParams, setSearchParams] = useURLSearchParams();

  const [nameFilter, setNameFilter] = useState(searchParams.get(AlertFolderViewParams.nameFilter) ?? '');
  const [labelFilter, setLabelFilter] = useState(searchParams.get(AlertFolderViewParams.labelFilter) ?? '');

  const sortParam = searchParams.get(AlertFolderViewParams.sortOrder);
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(
    sortParam === SortOrder.Ascending
      ? SortOrder.Ascending
      : sortParam === SortOrder.Descending
      ? SortOrder.Descending
      : undefined
  );

  useDebounce(
    () =>
      setSearchParams(
        {
          [AlertFolderViewParams.nameFilter]: getQueryParamValue(nameFilter),
          [AlertFolderViewParams.labelFilter]: getQueryParamValue(labelFilter),
          [AlertFolderViewParams.sortOrder]: getQueryParamValue(sortOrder),
        },
        true
      ),
    400,
    [nameFilter, labelFilter, sortOrder]
  );

  return { nameFilter, labelFilter, sortOrder, setNameFilter, setLabelFilter, setSortOrder };
}

function filterAndSortRules(
  originalRules: CombinedRule[],
  nameFilter: string,
  labelFilter: string,
  sortOrder: SortOrder
) {
  const matchers = parseMatchers(labelFilter);
  let rules = originalRules.filter(
    (rule) => rule.name.toLowerCase().includes(nameFilter.toLowerCase()) && labelsMatchMatchers(rule.labels, matchers)
  );

  return orderBy(rules, (x) => x.name.toLowerCase(), [sortOrder === SortOrder.Ascending ? 'asc' : 'desc']);
}

export const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
  `,
  card: css`
    grid-template-columns: auto 1fr 2fr;
    margin: 0;
  `,
  pagination: css`
    align-self: center;
  `,
  filterLabelsInput: css`
    flex: 1;
    width: auto;
    min-width: 240px;
  `,
  noResults: css`
    padding: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    font-style: italic;
  `,
});
