import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { flattenGrafanaManagedRules } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';

import { RulesGroup } from './RulesGroup';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const GrafanaRules: FC<Props> = ({ namespaces, expandAll }) => {
  const styles = useStyles(getStyles);
  const [queryParams] = useQueryParams();

  const { loading } = useUnifiedAlertingSelector(
    (state) => state.promRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState
  );

  const wantsGroupedView = queryParams['view'] === 'grouped';
  const namespacesFormat = wantsGroupedView ? namespaces : flattenGrafanaManagedRules(namespaces);

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h5>Grafana</h5>
        {loading ? <LoadingPlaceholder className={styles.loader} text="Loading..." /> : <div />}
      </div>

      {namespacesFormat?.map((namespace) =>
        namespace.groups.map((group) => (
          <RulesGroup
            group={group}
            key={`${namespace.name}-${group.name}`}
            namespace={namespace}
            expandAll={expandAll}
          />
        ))
      )}
      {namespacesFormat?.length === 0 && <p>No rules found.</p>}
    </section>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  loader: css`
    margin-bottom: 0;
  `,
  sectionHeader: css`
    display: flex;
    justify-content: space-between;
  `,
  wrapper: css`
    margin-bottom: ${theme.spacing.xl};
  `,
});
