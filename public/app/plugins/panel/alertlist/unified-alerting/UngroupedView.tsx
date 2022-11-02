import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';
import { alertStateToReadable, alertStateToState, getFirstActiveAt } from 'app/features/alerting/unified/utils/rules';
import { PromRuleWithLocation } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
import { UnifiedAlertListOptions } from '../types';

type UngroupedModeProps = {
  rules: PromRuleWithLocation[];
  options: UnifiedAlertListOptions;
};

const UngroupedModeView: FC<UngroupedModeProps> = ({ rules, options }) => {
  const styles = useStyles2(getStyles);
  const stateStyle = useStyles2(getStateTagStyles);

  const rulesToDisplay = rules.length <= options.maxItems ? rules : rules.slice(0, options.maxItems);

  return (
    <>
      <ol className={styles.alertRuleList}>
        {rulesToDisplay.map((ruleWithLocation, index) => {
          const { rule, namespaceName, groupName } = ruleWithLocation;
          const firstActiveAt = getFirstActiveAt(rule);
          return (
            <li className={styles.alertRuleItem} key={`alert-${namespaceName}-${groupName}-${rule.name}-${index}`}>
              <div className={stateStyle.icon}>
                <Icon
                  name={alertDef.getStateDisplayModel(rule.state).iconClass}
                  className={stateStyle[alertStateToState(rule.state)]}
                  size={'lg'}
                />
              </div>
              <div>
                <div className={styles.instanceDetails}>
                  <div className={styles.alertName} title={rule.name}>
                    {rule.name}
                  </div>
                  <div className={styles.alertDuration}>
                    <span className={stateStyle[alertStateToState(rule.state)]}>
                      {alertStateToReadable(rule.state)}
                    </span>{' '}
                    {firstActiveAt && rule.state !== PromAlertingRuleState.Inactive && (
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
                <AlertInstances alerts={ruleWithLocation.rule.alerts ?? []} options={options} />
              </div>
            </li>
          );
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
