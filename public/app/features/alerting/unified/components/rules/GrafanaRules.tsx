import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import React, { FC } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RulesGroup } from './RulesGroup';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import { initialAsyncRequestState } from '../../utils/redux';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

export const GrafanaRules: FC<Props> = ({ namespaces }) => {
  const styles = useStyles(getStyles);
  const { loading } = useUnifiedAlertingSelector(
    (state) => state.promRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <h5>Grafana</h5>
        {loading ? <LoadingPlaceholder className={styles.loader} text="Loading..." /> : <div />}
      </div>

      {namespaces?.map((namespace) =>
        namespace.groups.map((group) => (
          <RulesGroup group={group} key={`${namespace.name}-${group.name}`} namespace={namespace} />
        ))
      )}
      {namespaces?.length === 0 && <p>No rules found.</p>}
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
