import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { FC, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LoadingPlaceholder, Pagination, Spinner, useStyles2 } from '@grafana/ui';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getPaginationStyles } from '../../styles/pagination';
import { getRulesDataSources, getRulesSourceUid } from '../../utils/datasource';
import { isAsyncRequestStatePending } from '../../utils/redux';

import { RulesGroup } from './RulesGroup';
import { useCombinedGroupNamespace } from './useCombinedGroupNamespace';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const CloudRules: FC<Props> = ({ namespaces, expandAll }) => {
  const styles = useStyles2(getStyles);

  const dsConfigs = useUnifiedAlertingSelector((state) => state.dataSources);
  const promRules = useUnifiedAlertingSelector((state) => state.promRules);
  const rulesDataSources = useMemo(getRulesDataSources, []);
  const groupsWithNamespaces = useCombinedGroupNamespace(namespaces);

  const dataSourcesLoading = useMemo(
    () =>
      rulesDataSources.filter(
        (ds) => isAsyncRequestStatePending(promRules[ds.name]) || isAsyncRequestStatePending(dsConfigs[ds.name])
      ),
    [promRules, dsConfigs, rulesDataSources]
  );

  const hasSomeResults = rulesDataSources.some((ds) => promRules[ds.name]?.result?.length ?? 0 > 0);

  const hasDataSourcesConfigured = rulesDataSources.length > 0;
  const hasDataSourcesLoading = dataSourcesLoading.length > 0;
  const hasNamespaces = namespaces.length > 0;

  const { numberOfPages, onPageChange, page, pageItems } = usePagination(
    groupsWithNamespaces,
    1,
    DEFAULT_PER_PAGE_PAGINATION
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h5>Mimir / Cortex / Loki</h5>
        {dataSourcesLoading.length ? (
          <LoadingPlaceholder
            className={styles.loader}
            text={`Loading rules from ${dataSourcesLoading.length} ${pluralize('source', dataSourcesLoading.length)}`}
          />
        ) : (
          <div />
        )}
      </div>

      {pageItems.map(({ group, namespace }) => {
        return (
          <RulesGroup
            group={group}
            key={`${getRulesSourceUid(namespace.rulesSource)}-${namespace.name}-${group.name}`}
            namespace={namespace}
            expandAll={expandAll}
            viewMode={'grouped'}
          />
        );
      })}

      {!hasDataSourcesConfigured && <p>There are no Prometheus or Loki data sources configured.</p>}
      {hasDataSourcesConfigured && !hasDataSourcesLoading && !hasNamespaces && <p>No rules found.</p>}
      {!hasSomeResults && hasDataSourcesLoading && <Spinner size={24} className={styles.spinner} />}

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
