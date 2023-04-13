import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Spinner, useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { isAlertingRule, isRecordingRule, getFirstActiveAt } from '../../utils/rules';

import { AlertStateTag } from './AlertStateTag';

interface Props {
  rule: CombinedRule;
  isDeleting: boolean;
  isCreating: boolean;
  isPaused?: boolean;
}

export const RuleState = ({ rule, isDeleting, isCreating, isPaused }: Props) => {
  const style = useStyles2(getStyle);
  const { promRule } = rule;

  // return how long the rule has been in its firing state, if any
  const forTime = useMemo(() => {
    if (
      promRule &&
      isAlertingRule(promRule) &&
      promRule.alerts?.length &&
      promRule.state !== PromAlertingRuleState.Inactive
    ) {
      // find earliest alert
      const firstActiveAt = getFirstActiveAt(promRule);

      // calculate time elapsed from earliest alert
      if (firstActiveAt) {
        return (
          <span title={String(firstActiveAt)} className={style.for}>
            for{' '}
            {intervalToAbbreviatedDurationString(
              {
                start: firstActiveAt,
                end: new Date(),
              },
              false
            )}
          </span>
        );
      }
    }
    return null;
  }, [promRule, style]);

  if (isDeleting) {
    return (
      <Stack gap={1}>
        <Spinner />
        Deleting
      </Stack>
    );
  } else if (isCreating) {
    return (
      <Stack gap={1}>
        <Spinner />
        Creating
      </Stack>
    );
  } else if (promRule && isAlertingRule(promRule)) {
    return (
      <Stack gap={1}>
        <AlertStateTag state={promRule.state} isPaused={isPaused} />
        {forTime}
      </Stack>
    );
  } else if (promRule && isRecordingRule(promRule)) {
    return <>Recording rule</>;
  }
  return <>n/a</>;
};

const getStyle = (theme: GrafanaTheme2) => ({
  for: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    padding-top: 2px;
  `,
});
