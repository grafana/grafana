import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { CombinedRule } from '../../../../../types/unified-alerting';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { rulerRuleType } from '../../utils/rules';

interface RuleConfigStatusProps {
  rule: CombinedRule;
}

export function RuleConfigStatus({ rule }: RuleConfigStatusProps) {
  const styles = useStyles2(getStyles);
  const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule.rulerRule);

  const exceedsLimit = useMemo(() => {
    return isGrafanaManagedRule ? checkEvaluationIntervalGlobalLimit(rule.group.interval).exceedsLimit : false;
  }, [rule.group.interval, isGrafanaManagedRule]);

  if (!exceedsLimit) {
    return null;
  }

  return (
    <Tooltip
      theme="error"
      content={
        <div>
          A minimum evaluation interval of{' '}
          <span className={styles.globalLimitValue}>{config.unifiedAlerting.minInterval}</span> has been configured in
          Grafana and will be used instead of the {rule.group.interval} interval configured for the Rule Group.
        </div>
      }
    >
      <Icon name="stopwatch-slash" className={styles.icon} />
    </Tooltip>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    globalLimitValue: css({
      fontWeight: theme.typography.fontWeightBold,
    }),
    icon: css({
      fill: theme.colors.warning.text,
    }),
  };
}
