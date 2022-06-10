import { css, cx } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { LinkButton, useStyles } from '@grafana/ui';
import { MatcherFilter } from 'app/features/alerting/unified/components/alert-groups/MatcherFilter';
import { AlertInstanceStateFilter } from 'app/features/alerting/unified/components/rules/AlertInstanceStateFilter';
import { labelsMatchMatchers, parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { createViewLink, sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { Alert, CombinedRule } from 'app/types/unified-alerting';
import { GrafanaAlertState, mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { isAlertingRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';

import { AlertInstancesTable } from './AlertInstancesTable';

type Props = {
  rule: CombinedRule;
  pagination?: { itemsPerPage: number };
  itemsDisplayLimit?: number;
};

function ShowMoreInstances(props: { hiddenItemsCount: number; ruleViewPageLink: string }) {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.footerRow}>
      <div>
        +{props.hiddenItemsCount} more {pluralize('item', props.hiddenItemsCount)}...
      </div>
      {props.ruleViewPageLink && (
        <LinkButton href={props.ruleViewPageLink} size="sm" variant="secondary">
          Show all alert instances
        </LinkButton>
      )}
    </div>
  );
}

export function RuleDetailsMatchingInstances(props: Props): JSX.Element | null {
  const {
    rule: { promRule, namespace },
    itemsDisplayLimit,
    pagination,
  } = props;

  const [queryString, setQueryString] = useState<string>();
  const [alertState, setAlertState] = useState<GrafanaAlertState>();

  // This key is used to force a rerender on the inputs when the filters are cleared
  const [filterKey] = useState<number>(Math.floor(Math.random() * 100));
  const queryStringKey = `queryString-${filterKey}`;

  const styles = useStyles(getStyles);

  const alerts = useMemo(
    (): Alert[] =>
      isAlertingRule(promRule) && promRule.alerts?.length
        ? filterAlerts(queryString, alertState, sortAlerts(SortOrder.Importance, promRule.alerts))
        : [],
    [promRule, alertState, queryString]
  );

  if (!isAlertingRule(promRule)) {
    return null;
  }

  const visibleInstances = itemsDisplayLimit ? alerts.slice(0, itemsDisplayLimit) : alerts;
  const hiddenItemsCount = alerts.length - visibleInstances.length;
  const ruleViewPageLink = createViewLink(namespace.rulesSource, props.rule, location.pathname + location.search);

  const footerRow = hiddenItemsCount ? (
    <ShowMoreInstances hiddenItemsCount={hiddenItemsCount} ruleViewPageLink={ruleViewPageLink} />
  ) : undefined;

  return (
    <DetailsField label="Matching instances" horizontal={true}>
      <div className={cx(styles.flexRow, styles.spaceBetween)}>
        <div className={styles.flexRow}>
          <MatcherFilter
            className={styles.rowChild}
            key={queryStringKey}
            defaultQueryString={queryString}
            onFilterChange={(value) => setQueryString(value)}
          />
          <AlertInstanceStateFilter
            className={styles.rowChild}
            stateFilter={alertState}
            onStateFilterChange={setAlertState}
          />
        </div>
      </div>

      <AlertInstancesTable instances={visibleInstances} pagination={pagination} footerRow={footerRow} />
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
      return mapStateWithReasonToBaseState(alert.state) === alertInstanceState;
    });
  }

  return filteredAlerts;
}

const getStyles = (theme: GrafanaTheme) => {
  return {
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
    footerRow: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing.sm};
      justify-content: space-between;
      align-items: center;
      width: 100%;
    `,
  };
};
