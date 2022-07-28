import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { CombinedRuleGroup, Rule } from 'app/types/unified-alerting';

import { useEvaluationIntervalGlobalLimit } from '../rule-editor/GrafanaEvaluationBehavior';

interface Prom {
  rule: Rule;
  group: CombinedRuleGroup;
}

export const RuleHealth: FC<Prom> = ({ rule, group }) => {
  const style = useStyles2(getStyle);

  const { exceedsLimit } = useEvaluationIntervalGlobalLimit(group.interval ?? '');

  if (rule.health === 'err' || rule.health === 'error') {
    return (
      <Tooltip theme="error" content={rule.lastError || 'No error message provided.'}>
        <div className={style.warn}>
          <Icon name="exclamation-triangle" />
          <span>error</span>
        </div>
      </Tooltip>
    );
  }

  if (exceedsLimit) {
    return (
      <Tooltip
        theme="error"
        content={
          <div>
            A minimum evaluation interval of{' '}
            <span className={style.globalLimitValue}>{config.unifiedAlerting.minInterval}</span> have been configured in
            Grafana and will be used for this alert rule instead of {group.interval} configured for the alert group.
          </div>
        }
      >
        <div className={style.warn}>
          <Icon name="stopwatch-slash" />
        </div>
      </Tooltip>
    );
  }

  return <>{rule.health}</>;
};

const getStyle = (theme: GrafanaTheme2) => ({
  warn: css`
    display: inline-flex;
    flex-direction: row;
    color: ${theme.colors.warning.text};
    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
  globalLimitValue: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
