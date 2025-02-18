import { css } from '@emotion/css';
import { useState } from 'react';
import { useDebounce, useDeepCompareEffect } from 'react-use';

import { GrafanaTheme2, dateTime } from '@grafana/data';
import { Alert, Badge, Icon, LoadingPlaceholder, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { MatcherFieldValue } from 'app/features/alerting/unified/types/silence-form';
import { matcherFieldToMatcher } from 'app/features/alerting/unified/utils/alertmanager';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { AlertmanagerAlert, Matcher, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { isNullDate } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';

import { AmAlertStateTag } from './AmAlertStateTag';

interface Props {
  amSourceName: string;
  matchers: MatcherFieldValue[];
  ruleUid?: string;
}

/**
 * Performs a deep equality check on the dependencies, and debounces the callback
 */
const useDebouncedDeepCompare = (cb: () => void, debounceMs: number, dependencies: unknown[]) => {
  const [state, setState] = useState<unknown[]>();

  useDebounce(cb, debounceMs, [state]);

  useDeepCompareEffect(() => {
    setState(dependencies);
  }, [dependencies]);
};

export const SilencedInstancesPreview = ({ amSourceName, matchers: inputMatchers, ruleUid }: Props) => {
  const matchers: Matcher[] = [
    ...(ruleUid ? [{ name: MATCHER_ALERT_RULE_UID, value: ruleUid, operator: MatcherOperator.equal }] : []),
    ...inputMatchers,
  ].map(matcherFieldToMatcher);
  const useLazyQuery = alertmanagerApi.endpoints.getAlertmanagerAlerts.useLazyQuery;
  const styles = useStyles2(getStyles);
  const columns = useColumns();

  // By default the form contains an empty matcher - with empty name and value and = operator
  // We don't want to fetch previews for empty matchers as it results in all alerts returned
  const hasValidMatchers = ruleUid || inputMatchers.some((matcher) => matcher.value && matcher.name);

  const [getAlertmanagerAlerts, { currentData: alerts = [], isFetching, isError }] = useLazyQuery();

  // We need to deep compare the matchers, as otherwise the preview API call is triggered on every render
  // of the component. This is because between react-hook-form's useFieldArray, and our parsing of the matchers,
  // we end up otherwise triggering the call too frequently
  useDebouncedDeepCompare(
    () => {
      if (hasValidMatchers) {
        getAlertmanagerAlerts({ amSourceName, filter: { matchers } });
      }
    },
    500,
    [amSourceName, matchers]
  );

  if (isError) {
    return (
      <Alert title="Preview not available" severity="error">
        Error occurred when generating preview of affected alerts. Are your matchers valid?
      </Alert>
    );
  }

  const tableItemAlerts = alerts.map<DynamicTableItemProps<AlertmanagerAlert>>((alert) => ({
    id: alert.fingerprint,
    data: alert,
  }));

  return (
    <div>
      <h4 className={styles.title}>
        <Trans i18nKey="alerting.silences.affected-instances">Affected alert instances</Trans>
        <Tooltip
          content={
            <div>
              <Trans i18nKey="alerting.silences.preview-affected-instances">
                Preview the alert instances affected by this silence.
              </Trans>
              <br />
              <Trans i18nKey="alerting.silences.only-firing-instances">
                Only alert instances in the firing state are displayed.
              </Trans>
            </div>
          }
        >
          <span>
            &nbsp;
            <Icon name="info-circle" size="sm" />
          </span>
        </Tooltip>
        {tableItemAlerts.length > 0 ? (
          <Badge className={styles.badge} color="blue" text={tableItemAlerts.length} />
        ) : null}
      </h4>
      {!hasValidMatchers && <span>Add a valid matcher to see affected alerts</span>}

      {isFetching && <LoadingPlaceholder text="Loading affected alert rule instances..." />}
      {!isFetching && !isError && hasValidMatchers && (
        <div className={styles.table}>
          {tableItemAlerts.length > 0 ? (
            <DynamicTable
              items={tableItemAlerts}
              isExpandable={false}
              cols={columns}
              pagination={{ itemsPerPage: 10 }}
            />
          ) : (
            <span>No firing alert instances found</span>
          )}
        </div>
      )}
    </div>
  );
};

function useColumns(): Array<DynamicTableColumnProps<AlertmanagerAlert>> {
  const styles = useStyles2(getStyles);

  return [
    {
      id: 'state',
      label: 'State',
      renderCell: function renderStateTag({ data }) {
        return <AmAlertStateTag state={data.status.state} />;
      },
      size: '120px',
      className: styles.stateColumn,
    },
    {
      id: 'labels',
      label: 'Labels',
      renderCell: function renderName({ data }) {
        return <AlertLabels labels={data.labels} size="sm" />;
      },
      size: 'auto',
    },
    {
      id: 'created',
      label: 'Created',
      renderCell: function renderSummary({ data }) {
        return <>{isNullDate(data.startsAt) ? '-' : dateTime(data.startsAt).format('YYYY-MM-DD HH:mm:ss')}</>;
      },
      size: '180px',
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    maxWidth: `${theme.breakpoints.values.lg}px`,
  }),
  moreMatches: css({
    marginTop: theme.spacing(1),
  }),
  title: css({
    display: 'flex',
    alignItems: 'center',
  }),
  badge: css({
    marginLeft: theme.spacing(1),
  }),
  stateColumn: css({
    display: 'flex',
    alignItems: 'center',
  }),
});
