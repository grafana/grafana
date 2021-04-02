import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import React, { FC, useMemo } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RulesGroup } from './RulesGroup';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { RuleNamespace } from 'app/types/unified-alerting';
import { initialAsyncRequestState } from '../../utils/redux';

export const ThresholdRules: FC = () => {
  const styles = useStyles(getStyles);
  const { loading, result } = useUnifiedAlertingSelector(
    (state) => state.rules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState
  );

  const namespaces = useMemo(
    (): RuleNamespace[] =>
      (result || [])
        // sort groups within namespace
        .map((namespace) => ({
          ...namespace,
          groups: namespace.groups.slice().sort((a, b) => a.name.localeCompare(b.name)),
        }))
        // sort namespaces
        .sort((a, b) => a.name.localeCompare(b.name)),
    [result]
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h5>Threshold</h5>
        {loading ? <LoadingPlaceholder className={styles.loader} text="Loading..." /> : <div />}
      </div>

      {namespaces?.map((namespace) =>
        namespace.groups.map((group) => (
          <RulesGroup
            group={group}
            key={`${namespace.name}-${group.name}`}
            namespace={namespace.name}
            rulesSource={GRAFANA_RULES_SOURCE_NAME}
          />
        ))
      )}
      {namespaces?.length === 0 && !loading && <p>No rules found.</p>}
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
