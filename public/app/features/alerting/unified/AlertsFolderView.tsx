import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Card, FilterInput, Icon, Pagination, TagList, useStyles2 } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { FolderState } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';
import { isEqual, orderBy, uniqWith } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useDebounce } from 'react-use';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { usePagination } from './hooks/usePagination';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchPromRulesAction, fetchRulerRulesAction } from './state/actions';
import { labelsMatchMatchers, matchersToString, parseMatcher, parseMatchers } from './utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { createViewLink } from './utils/misc';

const ITEMS_PER_PAGE = 6;
interface Props {
  folder: FolderState;
}

type SortOrder = 'alpha-asc' | 'alpha-desc';

export const AlertsFolderView = ({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [sortOrder, setSortOrder] = useState<SortOrder>('alpha-asc');

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
  const { nameFilter, labelFilter, setNameFilter, setLabelFilter } = useAlertsFolderViewFilters();

  const matchingNamespace = combinedNamespaces.find((namespace) => namespace.name === folder.title);
  const alertRules = matchingNamespace?.groups[0]?.rules ?? [];

  const filteredRules = filterAndSortRules(alertRules, nameFilter, labelFilter, sortOrder);

  const showNoResultsText = alertRules.length === 0 || filteredRules.length === 0;
  const { page, numberOfPages, onPageChange, pageItems } = usePagination(filteredRules, 1, ITEMS_PER_PAGE);

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
          <SortPicker
            value={sortOrder}
            onChange={({ value }) => setSortOrder(value)}
            filter={['alpha-asc', 'alpha-desc']}
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
                  tags={Object.keys(currentRule.labels).map(
                    (labelKey) => `${labelKey}=${currentRule.labels[labelKey]}`
                  )}
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
        {showNoResultsText && <div className={styles.noResults}>No alert rules found</div>}
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

enum AlertFolderViewFilters {
  nameFilter = 'nameFilter',
  labelFilter = 'labelFilter',
}

function useAlertsFolderViewFilters() {
  const [searchParams, setSearchParams] = useURLSearchParams();

  const [nameFilter, setNameFilter] = useState(searchParams.get(AlertFolderViewFilters.nameFilter) ?? '');
  const [labelFilter, setLabelFilter] = useState(searchParams.get(AlertFolderViewFilters.labelFilter) ?? '');

  const [, cancelUrlUpdate] = useDebounce(
    () =>
      setSearchParams(
        {
          [AlertFolderViewFilters.nameFilter]: getNonEmptyStringOrUndefined(nameFilter),
          [AlertFolderViewFilters.labelFilter]: getNonEmptyStringOrUndefined(labelFilter),
        },
        true
      ),
    400,
    [nameFilter, labelFilter]
  );

  useEffect(
    () => () => {
      cancelUrlUpdate();
    },
    [cancelUrlUpdate]
  );

  return { nameFilter, labelFilter, setNameFilter, setLabelFilter };
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

  return orderBy(rules, (x) => x.name, [sortOrder === 'alpha-asc' ? 'asc' : 'desc']);
}

function getNonEmptyStringOrUndefined(value: string | undefined | null) {
  return value || undefined;
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
