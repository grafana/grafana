import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Card, FilterInput, Icon, Pagination, TagList, useStyles2 } from '@grafana/ui';
import { FolderState } from 'app/types';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { createViewLink } from './utils/misc';

interface Props {
  folder: FolderState;
}

export const AlertsFolderView = ({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    dispatch(fetchAllPromAndRulerRulesAction());
  }, [dispatch]);

  const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);

  const matchingNamespace = combinedNamespaces.find((namespace) => namespace.name === folder.title);
  const alertRules = matchingNamespace?.groups[0]?.rules ?? [];

  const filteredRules = alertRules.filter((rule) => rule.name.toLowerCase().includes(nameFilter.toLowerCase()));

  const { page, numberOfPages, onPageChange, pageItems } = usePagination(filteredRules, 1, 10);

  return (
    <Stack direction="column" gap={1}>
      <FilterInput value={nameFilter} onChange={setNameFilter} placeholder="Search alert rules by name" />
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

function usePagination<T>(items: T[], initialPage: number, itemsPerPage: number) {
  const [page, setPage] = useState(initialPage);

  const onPageChange = (newPage: number) => {
    setPage(newPage);
  };

  const numberOfPages = Math.ceil(items.length / itemsPerPage);

  const firstItemOnPageIndex = itemsPerPage * (page - 1);
  const pageItems = items.slice(firstItemOnPageIndex, firstItemOnPageIndex + itemsPerPage);

  return { page, onPageChange, numberOfPages, pageItems };
}

export const getStyles = (theme: GrafanaTheme2) => ({
  card: css`
    grid-template-columns: auto 1fr 2fr;
  `,
  pagination: css`
    align-self: center;
  `,
});
