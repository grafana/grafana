import React, { useEffect, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { Icon, useStyles2 } from '@grafana/ui';
import { Alert, PromRuleWithLocation } from 'app/types/unified-alerting';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { AlertStateTag } from 'app/features/alerting/unified/components/rules/AlertStateTag';
import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { omit } from 'lodash';
import { alertInstanceKey } from 'app/features/alerting/unified/utils/rules';

interface Props {
  ruleWithLocation: PromRuleWithLocation;
  showInstances: boolean;
}

export const AlertInstances = ({ ruleWithLocation, showInstances }: Props) => {
  const { rule } = ruleWithLocation;
  const [displayInstances, setDisplayInstances] = useState<boolean>(showInstances);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setDisplayInstances(showInstances);
  }, [showInstances]);

  // sort instances, because API returns them in random order every time
  const sortedAlerts = useMemo(
    (): Alert[] =>
      displayInstances
        ? rule.alerts.slice().sort((a, b) => alertInstanceKey(a).localeCompare(alertInstanceKey(b)))
        : [],
    [rule, displayInstances]
  );

  return (
    <div>
      {rule.state !== PromAlertingRuleState.Inactive && (
        <div className={styles.instance} onClick={() => setDisplayInstances(!displayInstances)}>
          <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />
          <span>{`${rule.alerts.length} ${pluralize('instance', rule.alerts.length)}`}</span>
        </div>
      )}

      {!!sortedAlerts.length && (
        <ol className={styles.list}>
          {sortedAlerts.map((alert, index) => {
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
