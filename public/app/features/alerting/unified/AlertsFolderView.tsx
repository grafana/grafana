import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Card, FilterInput, Icon, Pagination, TagList, useStyles2 } from '@grafana/ui';
import { FolderState } from 'app/types';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useDebounce } from 'react-use';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { labelsMatchMatchers, parseMatchers } from './utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { createViewLink } from './utils/misc';

interface Props {
  folder: FolderState;
}

export const AlertsFolderView = ({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchAllPromAndRulerRulesAction());
  }, [dispatch]);

  const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const { nameFilter, labelFilter, setNameFilter, setLabelFilter } = useAlertsFolderViewFilters();

  const matchingNamespace = combinedNamespaces.find((namespace) => namespace.name === folder.title);
  const alertRules = matchingNamespace?.groups[0]?.rules ?? [];

  const matchers = parseMatchers(labelFilter);
  const filteredRules = alertRules.filter(
    (rule) => rule.name.toLowerCase().includes(nameFilter.toLowerCase()) && labelsMatchMatchers(rule.labels, matchers)
  );

  const showNoResultsText = alertRules.length === 0 || filteredRules.length === 0;
  const { page, numberOfPages, onPageChange, pageItems } = usePagination(filteredRules, 1, 5);

  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row">
        <FilterInput
          value={nameFilter}
          onChange={setNameFilter}
          placeholder="Search alert rules by name"
          className={styles.filterInput}
        />
        <FilterInput
          value={labelFilter}
          onChange={setLabelFilter}
          placeholder="Search alert labels"
          className={styles.filterInput}
        />
      </Stack>
      <div>
        {pageItems.map((currentRule) => (
          <Card key={currentRule.name} href={createViewLink('grafana', currentRule, '')} className={styles.card}>
            <Card.Heading>{currentRule.name}</Card.Heading>
            <Card.Tags>
              <TagList
                tags={Object.keys(currentRule.labels).map((labelKey) => `${labelKey}=${currentRule.labels[labelKey]}`)}
              />
            </Card.Tags>
            <Card.Meta>
              <div>
                <Icon name="folder" /> {folder.title}
              </div>
            </Card.Meta>
          </Card>
        ))}
      </div>
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
          [AlertFolderViewFilters.nameFilter]: getNotEmptyStringOrUndefined(nameFilter),
          [AlertFolderViewFilters.labelFilter]: getNotEmptyStringOrUndefined(labelFilter),
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

function getNotEmptyStringOrUndefined(value: string | undefined | null) {
  return value || undefined;
}

function usePagination<T>(items: T[], initialPage: number, itemsPerPage: number) {
  const [page, setPage] = useState(initialPage);

  const numberOfPages = Math.ceil(items.length / itemsPerPage);

  const firstItemOnPageIndex = itemsPerPage * (page - 1);
  const pageItems = items.slice(firstItemOnPageIndex, firstItemOnPageIndex + itemsPerPage);

  const onPageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Reset the current page when number of changes has been changed
  useEffect(() => setPage(1), [numberOfPages]);

  return { page, onPageChange, numberOfPages, pageItems };
}

export const getStyles = (theme: GrafanaTheme2) => ({
  card: css`
    grid-template-columns: auto 1fr 2fr;
  `,
  pagination: css`
    align-self: center;
  `,
  filterInput: css`
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
