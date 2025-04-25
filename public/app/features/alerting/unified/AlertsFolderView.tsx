import { css } from '@emotion/css';
import { orderBy } from 'lodash';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Card, FilterInput, Icon, Pagination, Select, Stack, TagList, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { Trans, t } from 'app/core/internationalization';
import { getQueryParamValue } from 'app/core/utils/query';
import { FolderState, useDispatch } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';

import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { usePagination } from './hooks/usePagination';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchPromRulesAction, fetchRulerRulesAction } from './state/actions';
import { combineMatcherStrings, labelsMatchMatchers } from './utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { parsePromQLStyleMatcherLooseSafe } from './utils/matchers';
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
    const matchersString = combineMatcherStrings(labelFilter, tagName);
    setLabelFilter(matchersString);
  };

  useEffect(() => {
    dispatch(fetchPromRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
    dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
  }, [dispatch]);

  const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const { nameFilter, labelFilter, sortOrder, setNameFilter, setLabelFilter, setSortOrder } =
    useAlertsFolderViewParams();

  const matchingNamespace = combinedNamespaces.find((namespace) => namespace.uid === folder.uid);

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
          placeholder={t(
            'alerting.alerts-folder-view.name-filter-placeholder-search-alert-rules-by-name',
            'Search alert rules by name'
          )}
          data-testid="name-filter"
        />
        <Stack direction="row">
          <Select<SortOrder>
            value={sortOrder}
            onChange={({ value }) => value && setSortOrder(value)}
            options={sortOptions}
            width={25}
            aria-label={t('alerting.alerts-folder-view.aria-label-sort', 'Sort')}
            placeholder={t('alerting.alerts-folder-view.placeholder-sort-default-az', 'Sort (Default A-Z)')}
            prefix={<Icon name={sortOrder === SortOrder.Ascending ? 'sort-amount-up' : 'sort-amount-down'} />}
          />
          <FilterInput
            value={labelFilter}
            onChange={setLabelFilter}
            placeholder={t(
              'alerting.alerts-folder-view.label-filter-placeholder-search-alerts-by-labels',
              'Search alerts by labels'
            )}
            className={styles.filterLabelsInput}
            data-testid="label-filter"
          />
        </Stack>

        <Stack direction="column" gap={1}>
          {pageItems.map((currentRule) => (
            <Card
              key={Boolean(currentRule.uid) ? currentRule.uid : currentRule.name}
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
        {hasNoResults && (
          <div className={styles.noResults}>
            <Trans i18nKey="alerting.alerts-folder-view.no-alert-rules-found">No alert rules found</Trans>
          </div>
        )}
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
  const defaultSortOrder = (() => {
    if (sortParam === SortOrder.Ascending) {
      return SortOrder.Ascending;
    }
    if (sortParam === SortOrder.Descending) {
      return SortOrder.Descending;
    }
    return undefined;
  })();
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(defaultSortOrder);

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
  const matchers = parsePromQLStyleMatcherLooseSafe(labelFilter);
  const rules = originalRules.filter(
    (rule) => rule.name.toLowerCase().includes(nameFilter.toLowerCase()) && labelsMatchMatchers(rule.labels, matchers)
  );

  return orderBy(rules, (x) => x.name.toLowerCase(), [sortOrder === SortOrder.Ascending ? 'asc' : 'desc']);
}

export const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(1),
  }),
  card: css({
    gridTemplateColumns: 'auto 1fr 2fr',
    margin: 0,
  }),
  pagination: css({
    alignSelf: 'center',
  }),
  filterLabelsInput: css({
    flex: 1,
    width: 'auto',
    minWidth: '240px',
  }),
  noResults: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    fontStyle: 'italic',
  }),
});
