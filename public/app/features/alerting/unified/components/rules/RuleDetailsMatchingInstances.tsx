import { Alert, Rule } from 'app/types/unified-alerting';
import React, { useMemo, useState } from 'react';
import { isAlertingRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';
import { AlertInstancesTable } from './AlertInstancesTable';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';
import { GrafanaTheme } from '@grafana/data';
import { Icon, Input, Label, RadioButtonGroup, Tooltip, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { labelsMatchMatchers, parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { sortAlerts } from 'app/features/alerting/unified/utils/misc';

type Props = {
  promRule?: Rule;
};

export function RuleDetailsMatchingInstances(props: Props): JSX.Element | null {
  const { promRule } = props;

  const [queryString, setQueryString] = useState<string>();
  const [alertState, setAlertState] = useState<GrafanaAlertState>();

  // This key is used to force a rerender on the inputs when the filters are cleared
  const [filterKey] = useState<number>(Math.floor(Math.random() * 100));
  const queryStringKey = `queryString-${filterKey}`;

  const styles = useStyles(getStyles);

  const alerts = useMemo(
    (): Alert[] =>
      filterAlerts(
        queryString,
        alertState,
        sortAlerts(SortOrder.Importance, isAlertingRule(promRule) ? promRule.alerts : [])
      ),
    [promRule, alertState, queryString]
  );

  if (!alerts.length) {
    return null;
  }

  const stateOptions = Object.entries(GrafanaAlertState).map(([_, value]) => ({
    label: value,
    value,
  }));

  const searchIcon = <Icon name={'search'} />;
  return (
    <DetailsField label="Matching instances" horizontal={true}>
      <div className={cx(styles.flexRow, styles.spaceBetween)}>
        <div className={styles.flexRow}>
          <div className={styles.rowChild}>
            <Label>
              <Tooltip
                content={
                  <div>
                    Filter rules and alerts using label querying, ex:
                    <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
                  </div>
                }
              >
                <Icon name="info-circle" className={styles.tooltip} />
              </Tooltip>
              Search by label
            </Label>
            <Input
              key={queryStringKey}
              className={styles.inputWidth}
              prefix={searchIcon}
              value={queryString}
              defaultValue={queryString}
              onChange={(e) => setQueryString(e.currentTarget.value)}
              placeholder="Search"
              data-testid="search-query-input"
            />
          </div>
          <div className={styles.rowChild}>
            <Label>State</Label>
            <RadioButtonGroup
              value={alertState}
              options={stateOptions}
              onChange={setAlertState}
              onClick={(v) => {
                if (v === alertState) {
                  setAlertState(undefined);
                }
              }}
            />
          </div>
        </div>
      </div>

      <AlertInstancesTable instances={alerts} />
    </DetailsField>
  );
}

function filterAlerts(
  alertInstanceLabel: string | undefined,
  alertInstanceState: GrafanaAlertState | undefined,
  alerts: Alert[]
): Alert[] {
  let filteredAlerts = [...alerts];
  if (alertInstanceLabel) {
    const matchers = parseMatchers(alertInstanceLabel || '');
    filteredAlerts = filteredAlerts.filter(({ labels }) => labelsMatchMatchers(labels, matchers));
  }
  if (alertInstanceState) {
    filteredAlerts = filteredAlerts.filter((alert) => {
      return alert.state === alertInstanceState;
    });
  }

  return filteredAlerts;
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    inputWidth: css`
      width: 340px;
      flex-grow: 0;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      width: 100%;
      flex-wrap: wrap;
      margin-bottom: ${theme.spacing.sm};
    `,
    spaceBetween: css`
      justify-content: space-between;
    `,
    rowChild: css`
      margin-right: ${theme.spacing.sm};
    `,
    tooltip: css`
      margin: 0 ${theme.spacing.xs};
    `,
  };
};
