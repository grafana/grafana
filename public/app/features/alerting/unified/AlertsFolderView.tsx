import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Card, FilterInput, Icon, Pagination, TagList, useStyles2 } from '@grafana/ui';
import { FolderState } from 'app/types';
import { isEqual, uniqWith } from 'lodash';
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

interface Props {
  folder: FolderState;
}

const ITEMS_PER_PAGE = 20;

export const AlertsFolderView = ({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchPromRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
    dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
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
  const { page, numberOfPages, onPageChange, pageItems } = usePagination(filteredRules, 1, ITEMS_PER_PAGE);

  const onTagClick = (tagName: string) => {
    const tagMatcherField = parseMatcher(tagName);
    const uniqueMatchers = uniqWith([...matchers, tagMatcherField], isEqual);
    const matchersString = matchersToString(uniqueMatchers);
    setLabelFilter(matchersString);
  };

  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row">
        <FilterInput
          value={nameFilter}
          onChange={setNameFilter}
          placeholder="Search alert rules by name"
          className={styles.filterInput}
          data-testid="name-filter"
        />
        <FilterInput
          value={labelFilter}
          onChange={setLabelFilter}
          placeholder="Search alert labels"
          className={styles.filterInput}
          data-testid="label-filter"
        />
      </Stack>
      <div>
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

function getNonEmptyStringOrUndefined(value: string | undefined | null) {
  return value || undefined;
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
