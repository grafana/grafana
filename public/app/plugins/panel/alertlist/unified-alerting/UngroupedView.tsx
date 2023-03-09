import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { FC, useEffect, useState } from 'react';
import { useLocation } from 'react-use';

import {
  dateMath,
  GrafanaTheme2,
  intervalToAbbreviatedDurationString,
  RawTimeRange,
  RelativeTimeRange,
} from '@grafana/data';
import { describeTimeRange } from '@grafana/data/src/datetime/rangeutil';
import { Stack } from '@grafana/experimental';
import { getBackendSrv } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';
import { Spacer } from 'app/features/alerting/unified/components/Spacer';
import { fromCombinedRule, stringifyIdentifier } from 'app/features/alerting/unified/utils/rule-id';
import {
  alertStateToReadable,
  alertStateToState,
  getFirstActiveAt,
  isAlertingRule,
  isGrafanaRuleIdentifier,
} from 'app/features/alerting/unified/utils/rules';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { AlertingRule, CombinedRuleWithLocation } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { UnifiedAlertListOptions } from '../types';

type UngroupedModeProps = {
  rules: CombinedRuleWithLocation[];
  options: UnifiedAlertListOptions;
  timeRange?: RawTimeRange;
};

type HistoryResponse = {
  data: { values: string[][] };
};

export const useGetRulesWithExtraInfo = (
  returnTo: string,
  slicedRules: CombinedRuleWithLocation[],
  timeRange: RawTimeRange | undefined
) => {
  const [rulesToDisplay, setRulesToDisplay] = useState<CombinedRuleWithLocationExtended[] | undefined>(undefined);
  useEffect(() => {
    const getExtraInfo = async () => {
      const rulesWithExtraInfo: CombinedRuleWithLocationExtended[] = await Promise.all(
        slicedRules.map(async (rule: CombinedRuleWithLocation) => {
          const identifier = fromCombinedRule(rule.dataSourceName, rule);
          const strIndentifier = stringifyIdentifier(identifier);

          // create url to view rule
          const refToRuleView = createUrl(
            `/alerting/${encodeURIComponent(rule.dataSourceName)}/${encodeURIComponent(strIndentifier)}/view`,
            { returnTo: returnTo ?? '' }
          );

          //optional data from history
          let history: HistoryResponse | undefined = undefined;
          let firingCount: number | undefined;
          let relativeTime: string | undefined;

          // history is supported only for grafana-managed alerts so far.
          if (isGrafanaRuleIdentifier(identifier)) {
            let parsedTimeRange: RelativeTimeRange | undefined;
            if (timeRange) {
              parsedTimeRange = {
                from: dateMath.parse(timeRange.from)?.valueOf() ?? 0,
                to: dateMath.parse(timeRange.to)?.valueOf() ?? 0,
              };
            }
            history = await getBackendSrv().get('/api/v1/rules/history', {
              ruleUID: strIndentifier,
              ...parsedTimeRange,
            });
            firingCount =
              history &&
              history.data?.values[2].reduce((sum, state) => (state === GrafanaAlertState.Alerting ? sum + 1 : sum), 0);
            relativeTime = timeRange ? describeTimeRange(timeRange).toLocaleLowerCase() : undefined;
          }

          // fill ruleToDisplay with optional extra info
          const ruleToDisplay: CombinedRuleWithLocationExtended = {
            ...rule,
            refToRuleView: refToRuleView,
            firingCount: firingCount,
            relativeTime: relativeTime,
          };
          return ruleToDisplay;
        })
      );
      return rulesWithExtraInfo;
    };

    getExtraInfo().then((rules) => setRulesToDisplay(rules));
  }, [slicedRules, returnTo, timeRange]);
  return rulesToDisplay;
};

function FiringHistoryCount({
  firingCount,
  relativeTime,
}: {
  firingCount: number | undefined;
  relativeTime: string | undefined;
}) {
  const stateStyle = useStyles2(getStateTagStyles);
  if (firingCount === undefined) {
    return <span className={stateStyle.neutral}>No history available.</span>;
  }
  if (firingCount === 0) {
    return <span className={stateStyle.good}>{`No alerts (${relativeTime})`}.</span>;
  }
  return (
    <Stack alignItems="baseline" gap={0}>
      <span className={stateStyle.warning}>
        Fired {firingCount} {pluralize('time', firingCount)} {`(${relativeTime})`}.
      </span>
    </Stack>
  );
}

function AlertItem({
  ruleWithLocation,
  options,
  viewAlertRuleHref,
  firingCount,
  timeRange,
  relativeTime,
}: {
  ruleWithLocation: CombinedRuleWithLocation;
  options: UnifiedAlertListOptions;
  viewAlertRuleHref: string;
  firingCount: number | undefined;
  timeRange?: RawTimeRange;
  relativeTime?: string;
}) {
  const stateStyle = useStyles2(getStateTagStyles);
  const styles = useStyles2(getStyles);
  const alertingRule: AlertingRule | undefined = isAlertingRule(ruleWithLocation.promRule)
    ? ruleWithLocation.promRule
    : undefined;
  const firstActiveAt = getFirstActiveAt(alertingRule);

  if (alertingRule) {
    return (
      <li className={styles.alertRuleItem}>
        <div className={stateStyle.icon}>
          <Icon
            name={alertDef.getStateDisplayModel(alertingRule.state).iconClass}
            className={stateStyle[alertStateToState(alertingRule.state)]}
            size={'lg'}
          />
        </div>
        <div className={styles.alertNameWrapper}>
          <div className={styles.instanceDetails}>
            <Stack direction="row" gap={1} wrap={false}>
              <div className={styles.alertName} title={ruleWithLocation.name}>
                {ruleWithLocation.name}
              </div>
              <Spacer />
              <FiringHistoryCount firingCount={firingCount} relativeTime={relativeTime} />
              {viewAlertRuleHref && (
                <a href={viewAlertRuleHref} target="__blank" className={styles.link} rel="noopener">
                  <Stack alignItems="center" gap={1}>
                    View alert rule
                    <Icon name={'external-link-alt'} size="sm" />
                  </Stack>
                </a>
              )}
            </Stack>
            <div className={styles.alertDuration}>
              <span className={stateStyle[alertStateToState(alertingRule.state)]}>
                {alertStateToReadable(alertingRule.state)}
              </span>{' '}
              {firstActiveAt && alertingRule.state !== PromAlertingRuleState.Inactive && (
                <>
                  for{' '}
                  <span>
                    {intervalToAbbreviatedDurationString({
                      start: firstActiveAt,
                      end: Date.now(),
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          <AlertInstances alerts={alertingRule.alerts ?? []} options={options} />
        </div>
      </li>
    );
  } else {
    return null;
  }
}

export interface CombinedRuleWithLocationExtended extends CombinedRuleWithLocation {
  refToRuleView: string;
  firingCountInHistory?: number;
  firingCount?: number;
  relativeTime?: string;
}

const UngroupedModeView: FC<UngroupedModeProps> = ({ rules, options, timeRange }) => {
  const styles = useStyles2(getStyles);
  const { href: returnTo } = useLocation();

  const slicedRules = rules.length <= options.maxItems ? rules : rules.slice(0, options.maxItems);

  const rulesToDisplay = useGetRulesWithExtraInfo(returnTo ?? '', slicedRules, timeRange);
  return (
    <ol className={styles.alertRuleList}>
      {rulesToDisplay?.map((rule, index) => {
        return (
          <AlertItem
            key={`alert-${rule.namespaceName}-${rule.groupName}-${rule.name}-${index}`}
            ruleWithLocation={rule}
            options={options}
            viewAlertRuleHref={rule.refToRuleView}
            firingCount={rule.firingCount}
            relativeTime={rule.relativeTime}
          />
        );
      })}
    </ol>
  );
};

const getStateTagStyles = (theme: GrafanaTheme2) => ({
  common: css`
    width: 70px;
    text-align: center;
    align-self: stretch;

    display: inline-block;
    color: white;
    border-radius: ${theme.shape.borderRadius()};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: capitalize;
    line-height: 1.2;
    flex-shrink: 0;

    display: flex;
    flex-direction: column;
    justify-content: center;
  `,
  icon: css`
    margin-top: ${theme.spacing(2.5)};
    align-self: flex-start;
  `,
  good: css`
    color: ${theme.colors.success.main};
  `,
  bad: css`
    color: ${theme.colors.error.main};
  `,
  warning: css`
    color: ${theme.colors.warning.main};
  `,
  neutral: css`
    color: ${theme.colors.secondary.main};
  `,
  info: css`
    color: ${theme.colors.primary.main};
  `,
});

export default UngroupedModeView;
