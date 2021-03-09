import { RuleGroup } from 'app/types/unified-alerting/internal';
import React, { FC, useMemo, useState } from 'react';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import pluralize from 'pluralize';
import { isAlertingRule } from '../../utils/rules';
import { PromAlertingRuleState } from 'app/types/unified-alerting/dto';
import { RuleCollapse } from './RuleCollapse';

interface Props {
  group: RuleGroup;
}

export const RulesGroup: FC<Props> = ({ group }) => {
  const styles = useStyles(getStyles);

  const [isOpen, setIsOpen] = useState(false);

  const stats = useMemo(() => {
    const alertingRules = group.rules.filter(isAlertingRule);
    return {
      alertingRuleCount: alertingRules.length,
      firingRuleCount: alertingRules.filter((rule) => rule.state === PromAlertingRuleState.Firing).length,
      pendingRuleCount: alertingRules.filter((rule) => rule.state === PromAlertingRuleState.Pending).length,
    };
  }, [group]);

  const labelLeft = group.name;
  const labelRight = (
    <span className={styles.stats}>
      {stats.alertingRuleCount} {pluralize('alert', stats.alertingRuleCount)}: {stats.firingRuleCount} firing,{' '}
      {stats.pendingRuleCount} pending
    </span>
  );

  return (
    <RuleCollapse
      collapsible={true}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      labelLeft={labelLeft}
      labelRight={labelRight}
    >
      <p>@TODO</p>
    </RuleCollapse>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  stats: css`
    font-weight: ${theme.typography.weight.regular};
  `,
});
