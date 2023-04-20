import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-use';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';
import { Spacer } from 'app/features/alerting/unified/components/Spacer';
import { fromCombinedRule, stringifyIdentifier } from 'app/features/alerting/unified/utils/rule-id';
import {
  alertStateToReadable,
  alertStateToState,
  getFirstActiveAt,
  isAlertingRule,
} from 'app/features/alerting/unified/utils/rules';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from '../../../../features/alerting/unified/utils/datasource';
import { AlertingRule, AlertInstanceTotalState, CombinedRuleWithLocation } from '../../../../types/unified-alerting';
import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { UnifiedAlertListOptions } from '../types';

type Props = {
  rules: CombinedRuleWithLocation[];
  options: UnifiedAlertListOptions;
  handleInstancesLimit?: (limit: boolean) => void;
  limitInstances: boolean;
};

function getGrafanaInstancesTotal(totals: Partial<Record<AlertInstanceTotalState, number>>) {
  return Object.values(totals)
    .filter((total) => total !== undefined)
    .reduce((total, currentTotal) => total + currentTotal, 0);
}

const UngroupedModeView = ({ rules, options, handleInstancesLimit, limitInstances }: Props) => {
  const styles = useStyles2(getStyles);
  const stateStyle = useStyles2(getStateTagStyles);
  const { href: returnTo } = useLocation();

  const rulesToDisplay = rules.length <= options.maxItems ? rules : rules.slice(0, options.maxItems);

  return (
    <>
      <ol className={styles.alertRuleList}>
        {rulesToDisplay.map((ruleWithLocation, index) => {
          const { namespaceName, groupName, dataSourceName } = ruleWithLocation;
          const alertingRule: AlertingRule | undefined = isAlertingRule(ruleWithLocation.promRule)
            ? ruleWithLocation.promRule
            : undefined;
          const firstActiveAt = getFirstActiveAt(alertingRule);
          const indentifier = fromCombinedRule(ruleWithLocation.dataSourceName, ruleWithLocation);
          const strIndentifier = stringifyIdentifier(indentifier);

          const grafanaInstancesTotal =
            ruleWithLocation.dataSourceName === GRAFANA_RULES_SOURCE_NAME
              ? getGrafanaInstancesTotal(ruleWithLocation.instanceTotals)
              : undefined;
          const grafanaFilteredInstancesTotal =
            ruleWithLocation.dataSourceName === GRAFANA_RULES_SOURCE_NAME
              ? getGrafanaInstancesTotal(ruleWithLocation.filteredInstanceTotals)
              : undefined;

          const href = createUrl(
            `/alerting/${encodeURIComponent(dataSourceName)}/${encodeURIComponent(strIndentifier)}/view`,
            { returnTo: returnTo ?? '' }
          );
          if (alertingRule) {
            return (
              <li
                className={styles.alertRuleItem}
                key={`alert-${namespaceName}-${groupName}-${ruleWithLocation.name}-${index}`}
              >
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
                      {href && (
                        <a href={href} target="__blank" className={styles.link} rel="noopener">
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
                  <AlertInstances
                    alerts={alertingRule.alerts ?? []}
                    options={options}
                    grafanaTotalInstances={grafanaInstancesTotal}
                    grafanaFilteredInstancesTotal={grafanaFilteredInstancesTotal}
                    handleInstancesLimit={handleInstancesLimit}
                    limitInstances={limitInstances}
                  />
                </div>
              </li>
            );
          } else {
            return null;
          }
        })}
      </ol>
    </>
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
