import React, { useEffect, useState } from 'react';
import pluralize from 'pluralize';
import { Icon, useStyles2 } from '@grafana/ui';
import { PromRuleWithLocation } from 'app/types/unified-alerting';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { AlertStateTag } from 'app/features/alerting/unified/components/rules/AlertStateTag';
import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { omit } from 'lodash';

interface Props {
  rule: PromRuleWithLocation;
  showInstances: boolean;
}

export const AlertInstances = ({ rule, showInstances }: Props) => {
  const [displayInstances, setDisplayInstances] = useState<boolean>(showInstances);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setDisplayInstances(showInstances);
  }, [showInstances]);

  return (
    <div>
      {rule.state !== PromAlertingRuleState.Inactive && (
        <div className={styles.instance} onClick={() => setDisplayInstances(!displayInstances)}>
          <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />
          <span>{`${rule.alerts.length} ${pluralize('instance', rule.alerts.length)}`}</span>
        </div>
      )}

      {displayInstances && rule.state !== PromAlertingRuleState.Inactive && (
        <ol className={styles.list}>
          {rule.alerts.map((alert, index) => {
            return (
              <li className={styles.listItem} key={`${alert.activeAt}-${index}`}>
                <div>
                  <AlertStateTag state={alert.state} />
                  <span className={styles.date}>{dateTime(alert.activeAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                </div>
                <AlertLabels labels={omit(alert.labels, 'alertname')} />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  instance: css`
    cursor: pointer;
  `,
  list: css`
    list-style-type: none;
  `,
  listItem: css`
    margin-top: ${theme.spacing(1)};
  `,
  date: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    padding-left: ${theme.spacing(0.5)};
  `,
});
