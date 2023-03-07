import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { FC, useEffect, useState } from 'react';
import { useLocation } from 'react-use';

import { addDurationToDate, GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
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
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { RelativeTimeRange } from '../../../../../../packages/grafana-data/src/types/time';
import { AlertingRule, CombinedRuleWithLocation } from '../../../../types/unified-alerting';
import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { UnifiedAlertListOptions } from '../types';

type UngroupedModeProps = {
  rules: CombinedRuleWithLocation[];
  options: UnifiedAlertListOptions;
};

export const useGetExtraInfoForAlertItem = (returnTo: string, slicedRules: CombinedRuleWithLocation[]) => {
  const [rulesToDisplay, setRulesToDisplay] = useState<CombinedRuleWithLocationExtended[] | undefined>(undefined);
  useEffect(() => {
    const getExtraInfo = async () => {
      const rulesWithExtraInfo: CombinedRuleWithLocationExtended[] = await Promise.all(
        slicedRules.map(async (rule: CombinedRuleWithLocation) => {
          const identifier = fromCombinedRule(rule.dataSourceName, rule);
          const strIndentifier = stringifyIdentifier(identifier);

          const refToRuleView = createUrl(
            `/alerting/${encodeURIComponent(rule.dataSourceName)}/${encodeURIComponent(strIndentifier)}/view`,
            { returnTo: returnTo ?? '' }
          );
          type HistoryResponse = {
            data: { values: string[][] };
          };
          let history: HistoryResponse | undefined = undefined;
          // history is supported only for grafana-managed alerts so far.
          if (isGrafanaRuleIdentifier(identifier)) {
            const now = new Date().getTime();
            const aWeekAgo = addDurationToDate(now, { days: -7 }).getTime();
            const timeRange: RelativeTimeRange = {
              from: aWeekAgo,
              to: now,
            };
            history = await getBackendSrv().get('/api/v1/rules/history', { ruleUID: strIndentifier, ...timeRange });
          }
          let firingCount =
            history &&
            history.data?.values[2].reduce(
              (sum, state, index) => (state === GrafanaAlertState.Alerting ? sum + 1 : sum),
              0
            );

          const ruleToDisplay: CombinedRuleWithLocationExtended = {
            ...rule,
            refToRuleView: refToRuleView,
            firingCount: firingCount,
          };
          return ruleToDisplay;
        })
      );
      return rulesWithExtraInfo;
    };

    getExtraInfo().then((rules) => setRulesToDisplay(rules));
  }, [slicedRules, returnTo]);
  return rulesToDisplay;
};

function FiringHistoryCount({ firingCount }: { firingCount: number | undefined }) {
  const stateStyle = useStyles2(getStateTagStyles);
  if (firingCount === undefined) {
    return <span className={stateStyle.neutral}>No history available.</span>;
  }
  if (firingCount === 0) {
    return <span className={stateStyle.good}>No alerts in the past month.</span>;
  }
  return (
    <Stack alignItems="baseline" gap={0}>
      <span className={stateStyle.warning}>
        Fired {firingCount} {pluralize('time', firingCount)} (past week).
      </span>
    </Stack>
  );
}

function AlertItem({
  ruleWithLocation,
  options,
  viewAlertRuleHref,
  firingCount,
}: {
  ruleWithLocation: CombinedRuleWithLocation;
  options: UnifiedAlertListOptions;
  viewAlertRuleHref: string;
  firingCount: number | undefined;
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
              <FiringHistoryCount firingCount={firingCount} />
              {viewAlertRuleHref && ( //not necessary now?
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
}

const UngroupedModeView: FC<UngroupedModeProps> = ({ rules, options }) => {
  const styles = useStyles2(getStyles);
  const { href: returnTo } = useLocation();

  const slicedRules = rules.length <= options.maxItems ? rules : rules.slice(0, options.maxItems);

  const rulesToDisplay = useGetExtraInfoForAlertItem(returnTo ?? '', slicedRules);
  if (rulesToDisplay) {
    return (
      <ol className={styles.alertRuleList}>
        {rulesToDisplay.map((rule, index) => {
          return (
            <AlertItem
              key={`alert-${rule.namespaceName}-${rule.groupName}-${rule.name}-${index}`}
              ruleWithLocation={rule}
              options={options}
              viewAlertRuleHref={rule.refToRuleView}
              firingCount={rule.firingCount}
            />
          );
        })}
      </ol>
    );
  } else {
    return null;
  }
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
