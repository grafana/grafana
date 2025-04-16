import { css, cx } from '@emotion/css';
import { countBy, sum } from 'lodash';
import * as React from 'react';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { MatcherFilter } from 'app/features/alerting/unified/components/alert-groups/MatcherFilter';
import {
  AlertInstanceStateFilter,
  InstanceStateFilter,
} from 'app/features/alerting/unified/components/rules/AlertInstanceStateFilter';
import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { createViewLink, sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { Alert, CombinedRule, PaginationProps } from 'app/types/unified-alerting';
import { mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { Trans } from '../../../../../core/internationalization';
import { GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from '../../utils/datasource';
import { parsePromQLStyleMatcherLooseSafe } from '../../utils/matchers';
import { prometheusRuleType } from '../../utils/rules';

import { AlertInstancesTable } from './AlertInstancesTable';
import { getComponentsFromStats } from './RuleStats';

interface Props {
  rule: CombinedRule;
  pagination?: PaginationProps;
  itemsDisplayLimit?: number;
  enableFiltering?: boolean;
}

interface ShowMoreStats {
  totalItemsCount: number;
  visibleItemsCount: number;
}

interface ShowMoreInstancesProps {
  stats: ShowMoreStats;
  onClick?: React.ComponentProps<typeof LinkButton>['onClick'];
  href?: React.ComponentProps<typeof LinkButton>['href'];
}

function ShowMoreInstances({ stats, onClick, href }: ShowMoreInstancesProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.footerRow}>
      <div>
        <Trans
          i18nKey="alerting.rule-details-matching-instances.showing-count"
          values={{ visibleItems: stats.visibleItemsCount, totalItems: stats.totalItemsCount }}
        >
          Showing {'{{visibleItems}}'} out of {'{{totalItems}}'} instances
        </Trans>
      </div>
      <LinkButton size="sm" variant="secondary" data-testid="show-all" onClick={onClick} href={href}>
        <Trans i18nKey="alerting.rule-details-matching-instances.button-show-all" count={stats.totalItemsCount}>
          Show all {'{{totalItems}}'} alert instances
        </Trans>
      </LinkButton>
    </div>
  );
}

export function RuleDetailsMatchingInstances(props: Props) {
  const { rule, itemsDisplayLimit = Number.POSITIVE_INFINITY, pagination, enableFiltering = false } = props;
  const { promRule, namespace, instanceTotals } = rule;

  const [queryString, setQueryString] = useState<string>();
  const [alertState, setAlertState] = useState<InstanceStateFilter>();

  // This key is used to force a rerender on the inputs when the filters are cleared
  const [filterKey] = useState<number>(Math.floor(Math.random() * 100));
  const queryStringKey = `queryString-${filterKey}`;

  const styles = useStyles2(getStyles);

  const stateFilterType = isGrafanaRulesSource(namespace.rulesSource) ? GRAFANA_RULES_SOURCE_NAME : 'prometheus';

  const alerts = useMemo(
    (): Alert[] =>
      prometheusRuleType.alertingRule(promRule) && promRule.alerts?.length
        ? filterAlerts(queryString, alertState, sortAlerts(SortOrder.Importance, promRule.alerts))
        : [],
    [promRule, alertState, queryString]
  );

  if (!prometheusRuleType.alertingRule(promRule)) {
    return null;
  }

  const visibleInstances = alerts.slice(0, itemsDisplayLimit);

  // Count All By State is used only when filtering is enabled and we have access to all instances
  const countAllByState = countBy(promRule.alerts, (alert) => mapStateWithReasonToBaseState(alert.state));

  // error state is not a separate state
  const totalInstancesCount = sum([
    instanceTotals.alerting,
    instanceTotals.inactive,
    instanceTotals.pending,
    instanceTotals.recovering,
    instanceTotals.nodata,
  ]);
  const hiddenInstancesCount = totalInstancesCount - visibleInstances.length;

  const stats: ShowMoreStats = {
    totalItemsCount: totalInstancesCount,
    visibleItemsCount: visibleInstances.length,
  };

  // createViewLink returns a link containing the app subpath prefix hence cannot be used
  // in locationService.push as it will result in a double prefix
  const ruleViewPageLink = createViewLink(namespace.rulesSource, props.rule, location.pathname + location.search);
  const statsComponents = getComponentsFromStats(instanceTotals);

  const resetFilter = () => setAlertState(undefined);

  const footerRow = hiddenInstancesCount ? (
    <ShowMoreInstances
      stats={stats}
      onClick={enableFiltering ? resetFilter : undefined}
      href={!enableFiltering ? ruleViewPageLink : undefined}
    />
  ) : undefined;

  return (
    <>
      {enableFiltering && (
        <div className={cx(styles.flexRow, styles.spaceBetween)}>
          <div className={styles.flexRow}>
            <MatcherFilter
              key={queryStringKey}
              defaultQueryString={queryString}
              onFilterChange={(value) => setQueryString(value)}
            />
            <AlertInstanceStateFilter
              filterType={stateFilterType}
              stateFilter={alertState}
              onStateFilterChange={setAlertState}
              itemPerStateStats={countAllByState}
            />
          </div>
        </div>
      )}
      {!enableFiltering && <div className={styles.stats}>{statsComponents}</div>}
      <AlertInstancesTable rule={rule} instances={visibleInstances} pagination={pagination} footerRow={footerRow} />
    </>
  );
}

function filterAlerts(
  alertInstanceLabel: string | undefined,
  alertInstanceState: InstanceStateFilter | undefined,
  alerts: Alert[]
): Alert[] {
  let filteredAlerts = [...alerts];
  if (alertInstanceLabel) {
    const matchers = alertInstanceLabel ? parsePromQLStyleMatcherLooseSafe(alertInstanceLabel) : [];
    filteredAlerts = filteredAlerts.filter(({ labels }) => labelsMatchMatchers(labels, matchers));
  }
  if (alertInstanceState) {
    filteredAlerts = filteredAlerts.filter((alert) => {
      return mapStateWithReasonToBaseState(alert.state) === alertInstanceState;
    });
  }

  return filteredAlerts;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    flexRow: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-end',
      width: '100%',
      flexWrap: 'wrap',
      marginBottom: theme.spacing(1),
      gap: theme.spacing(1),
    }),
    spaceBetween: css({
      justifyContent: 'space-between',
    }),
    footerRow: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }),
    instancesContainer: css({
      marginBottom: theme.spacing(2),
    }),
    stats: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0),
    }),
  };
};
