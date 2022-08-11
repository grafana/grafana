import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { FC, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LoadingPlaceholder, Pagination, useStyles2 } from '@grafana/ui';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getPaginationStyles } from '../../styles/pagination';
import { getRulesDataSources, getRulesSourceUid } from '../../utils/datasource';

import { RulesGroup } from './RulesGroup';
import { useCombinedGroupNamespace } from './useCombinedGroupNamespace';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const CloudRules: FC<Props> = ({ namespaces, expandAll }) => {
  const styles = useStyles2(getStyles);

  const dsConfigs = useUnifiedAlertingSelector((state) => state.dataSources);
  const rules = useUnifiedAlertingSelector((state) => state.promRules);
  const rulesDataSources = useMemo(getRulesDataSources, []);
  const groupsWithNamespaces = useCombinedGroupNamespace(namespaces);

  const dataSourcesLoading = useMemo(
    () => rulesDataSources.filter((ds) => rules[ds.name]?.loading || dsConfigs[ds.name]?.loading),
    [rules, dsConfigs, rulesDataSources]
  );

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
      {namespaces?.length === 0 && !!rulesDataSources.length && <p>No rules found.</p>}
      {!rulesDataSources.length && <p>There are no Prometheus or Loki data sources configured.</p>}
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
  pagination: getPaginationStyles(theme),
});
