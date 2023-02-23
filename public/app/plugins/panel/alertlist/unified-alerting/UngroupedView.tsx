import { css } from '@emotion/css';
import React, { FC } from 'react';
import useLocation from 'react-use/lib/useLocation';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
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

import { AlertingRule, CombinedRuleWithLocation } from '../../../../types/unified-alerting';
import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { UnifiedAlertListOptions } from '../types';

type UngroupedModeProps = {
  rules: CombinedRuleWithLocation[];
  options: UnifiedAlertListOptions;
};

const UngroupedModeView: FC<UngroupedModeProps> = ({ rules, options }) => {
  const styles = useStyles2(getStyles);
  const stateStyle = useStyles2(getStateTagStyles);
  const { href: returnTo } = useLocation();

  const rulesToDisplay = rules.length <= options.maxItems ? rules : rules.slice(0, options.maxItems);

  return (
    <>
      <ol className={styles.alertRuleList}>
        {rulesToDisplay.map((ruleWithLocation, index) => {
          const { rule, namespaceName, groupName, dataSourceName } = ruleWithLocation;
          const alertingRule: AlertingRule | undefined = isAlertingRule(rule.promRule) ? rule.promRule : undefined;
          const firstActiveAt = getFirstActiveAt(alertingRule);
          const indentifier = fromCombinedRule(ruleWithLocation.dataSourceName, ruleWithLocation.rule);
          const strIndentifier = stringifyIdentifier(indentifier);

          const href = createUrl(
            `/alerting/${encodeURIComponent(dataSourceName)}/${encodeURIComponent(strIndentifier)}/view`,
            { returnTo: returnTo ?? '' }
          );
          if (alertingRule) {
            return (
              <li className={styles.alertRuleItem} key={`alert-${namespaceName}-${groupName}-${rule.name}-${index}`}>
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
                      <div className={styles.alertName} title={rule.name}>
                        {rule.name}
                      </div>
                      <Spacer />
                      {href && (
                        <LinkButton target="_blank" rel="noopener" href={href} size="sm" icon="external-link-alt">
                          Details
                        </LinkButton>
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
