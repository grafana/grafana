import { css } from '@emotion/css';
import { useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { useStyles2 } from '@grafana/ui/themes';
import { type CombinedRule } from 'app/types/unified-alerting';
import { type PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { alertStateToReadable } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';

import { RulesTable } from './RulesTable';

interface Props {
  rules: CombinedRule[];
  state: PromAlertingRuleState;
  defaultCollapsed?: boolean;
}

export const RuleListStateSection = ({ rules, state, defaultCollapsed = false }: Props) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const styles = useStyles2(getStyles);
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
      {!collapsed && <RulesTable className={styles.rulesTable} rules={rules} showGroupColumn={true} />}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  collapseToggle: css({
    verticalAlign: 'middle',
  }),
  header: css({
    marginTop: theme.spacing(2),
  }),
  rulesTable: css({
    marginTop: theme.spacing(3),
  }),
});
