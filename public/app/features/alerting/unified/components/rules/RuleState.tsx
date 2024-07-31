import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Icon, Spinner, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { getFirstActiveAt, isAlertingRule, isGrafanaRecordingRule, isRecordingRule } from '../../utils/rules';
import { StateTag } from '../StateTag';

import { AlertStateTag } from './AlertStateTag';

interface Props {
  rule: CombinedRule;
  isDeleting: boolean;
  isCreating: boolean;
  isPaused?: boolean;
}

export const RuleState = ({ rule, isDeleting, isCreating, isPaused }: Props) => {
  const style = useStyles2(getStyle);
  const { promRule, rulerRule } = rule;
  // return how long the rule has been in its firing state, if any
  const RecordingRuleState = () => {
    if (isPaused && isGrafanaRecordingRule(rulerRule)) {
      return (
        <Tooltip content={'Recording rule evaluation is currently paused'} placement="top">
          <StateTag state="warning">
            <Icon name="pause" size="xs" />
            <Trans i18nKey="alerting.rule-state.paused">Paused</Trans>
          </StateTag>
        </Tooltip>
      );
    } else {
      return <Trans i18nKey="alerting.rule-state.recording-rule">Recording rule</Trans>;
    }
  };
  const forTime = useMemo(() => {
    if (
      promRule &&
      isAlertingRule(promRule) &&
      promRule.alerts?.length &&
      promRule.state !== PromAlertingRuleState.Inactive
    ) {
      // find earliest alert
      const firstActiveAt = promRule.activeAt ? new Date(promRule.activeAt) : getFirstActiveAt(promRule);

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
        <Trans i18nKey="alerting.rule-state.deleting">Deleting</Trans>
      </Stack>
    );
  } else if (isCreating) {
    return (
      <Stack gap={1}>
        <Spinner />
        <Trans i18nKey="alerting.rule-state.creating">Creating</Trans>
      </Stack>
    );
  } else if (promRule && isAlertingRule(promRule)) {
    return (
      <Stack gap={1}>
        <AlertStateTag state={promRule.state} isPaused={isPaused} />
        {!isPaused && forTime}
      </Stack>
    );
  } else if (promRule && isRecordingRule(promRule)) {
    return <RecordingRuleState />;
  }
  return <>n/a</>;
};

const getStyle = (theme: GrafanaTheme2) => ({
  for: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
    paddingTop: '2px',
  }),
});
