import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import React, { FC, useState } from 'react';
import { alertStateToReadable } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RulesTable } from './RulesTable';

interface Props {
  rules: CombinedRule[];
  state: PromAlertingRuleState;
  defaultCollapsed?: boolean;
}

export const RuleListStateSection: FC<Props> = ({ rules, state, defaultCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const styles = useStyles(getStyles);
  return (
    <>
      <h4 className={styles.header}>
        <CollapseToggle
          className={styles.collapseToggle}
          size="xxl"
          isCollapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
        {alertStateToReadable(state)} ({rules.length})
      </h4>
      {!collapsed && <RulesTable rules={rules} showGroupColumn={true} />}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  collapseToggle: css`
    vertical-align: middle;
  `,
  header: css`
    margin-top: ${theme.spacing.md};
  `,
});
