import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LoadingPlaceholder, Pagination, Spinner, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { flattenGrafanaManagedRules } from '../../hooks/useCombinedRuleNamespaces';
import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getPaginationStyles } from '../../styles/pagination';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';

import { RulesGroup } from './RulesGroup';
import { useCombinedGroupNamespace } from './useCombinedGroupNamespace';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const GrafanaRules: FC<Props> = ({ namespaces, expandAll }) => {
  const styles = useStyles2(getStyles);
  const [queryParams] = useQueryParams();

  const { prom, ruler } = useUnifiedAlertingSelector((state) => ({
    prom: state.promRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState,
    ruler: state.rulerRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState,
  }));

  const loading = prom.loading || ruler.loading;
  const hasResult = !!prom.result || !!ruler.result;

  const wantsListView = queryParams['view'] === 'list';
  const namespacesFormat = wantsListView ? flattenGrafanaManagedRules(namespaces) : namespaces;

  const groupsWithNamespaces = useCombinedGroupNamespace(namespacesFormat);

  const { numberOfPages, onPageChange, page, pageItems } = usePagination(
    groupsWithNamespaces,
    1,
    DEFAULT_PER_PAGE_PAGINATION
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h5>Grafana</h5>
        {loading ? <LoadingPlaceholder className={styles.loader} text="Loading..." /> : <div />}
      </div>

      {pageItems.map(({ group, namespace }) => (
        <RulesGroup
          group={group}
          key={`${namespace.name}-${group.name}`}
          namespace={namespace}
          expandAll={expandAll}
          viewMode={wantsListView ? 'list' : 'grouped'}
        />
      ))}
      {hasResult && namespacesFormat?.length === 0 && <p>No rules found.</p>}
      {!hasResult && loading && <Spinner size={24} className={styles.spinner} />}
      <Pagination
        className={styles.pagination}
        currentPage={page}
        numberOfPages={numberOfPages}
        onNavigate={onPageChange}
        hideWhenSinglePage
      />
    </section>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  loader: css`
    margin-bottom: 0;
  `,
  sectionHeader: css`
    display: flex;
    justify-content: space-between;
  `,
  wrapper: css`
    margin-bottom: ${theme.spacing(4)};
  `,
  spinner: css`
    text-align: center;
    padding: ${theme.spacing(2)};
  `,
  pagination: getPaginationStyles(theme),
});
