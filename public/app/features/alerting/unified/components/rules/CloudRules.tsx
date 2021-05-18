import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import React, { FC, useMemo } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RulesGroup } from './RulesGroup';
import { getRulesDataSources, getRulesSourceName } from '../../utils/datasource';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import pluralize from 'pluralize';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

export const CloudRules: FC<Props> = ({ namespaces }) => {
  const styles = useStyles(getStyles);
  const rules = useUnifiedAlertingSelector((state) => state.promRules);
  const rulesDataSources = useMemo(getRulesDataSources, []);

  const dataSourcesLoading = useMemo(() => rulesDataSources.filter((ds) => rules[ds.name]?.loading), [
    rules,
    rulesDataSources,
  ]);

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h5>Cortex / Loki</h5>
        {dataSourcesLoading.length ? (
          <LoadingPlaceholder
            className={styles.loader}
            text={`Loading rules from ${dataSourcesLoading.length} ${pluralize('source', dataSourcesLoading.length)}`}
          />
        ) : (
          <div />
        )}
      </div>

      {namespaces.map((namespace) => {
        const { groups, rulesSource } = namespace;
        return groups.map((group) => (
          <RulesGroup
            group={group}
            key={`${getRulesSourceName(rulesSource)}-${name}-${group.name}`}
            namespace={namespace}
          />
        ));
      })}
      {namespaces?.length === 0 && !!rulesDataSources.length && <p>No rules found.</p>}
      {!rulesDataSources.length && <p>There are no Prometheus or Loki datas sources configured.</p>}
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
