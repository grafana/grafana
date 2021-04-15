import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { capitalize } from 'lodash';
import React, { FC } from 'react';
import { RulesTable } from './RulesTable';

interface Props {
  rules: CombinedRule[];
  state: PromAlertingRuleState;
}

export const RuleListStateSection: FC<Props> = ({ rules, state }) => {
  const styles = useStyles(getStyles);
  return (
    <>
      <h4 className={styles.header}>
        {capitalize(state)} ({rules.length})
      </h4>
      <RulesTable rules={rules} />
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  header: css`
    margin-top: ${theme.spacing.md};
  `,
});
