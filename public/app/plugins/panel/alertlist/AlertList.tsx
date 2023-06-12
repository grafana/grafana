import { css, cx } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { dateMath, dateTime, GrafanaTheme2, PanelProps } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { Card, CustomScrollbar, Icon, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { AlertRuleDTO, AnnotationItemDTO } from 'app/types';

import { AlertListOptions, ShowOption, SortOrder } from './types';

export function AlertList(props: PanelProps<AlertListOptions>) {
  const [noAlertsMessage, setNoAlertsMessage] = useState('');

  const currentAlertState = useAsync(async () => {
    if (props.options.showOptions !== ShowOption.Current) {
      return;
    }

    const params: any = {
      state: getStateFilter(props.options.stateFilter),
    };
    const panel = getDashboardSrv().getCurrent()?.getPanelById(props.id)!;

    if (props.options.alertName) {
      params.query = getTemplateSrv().replace(props.options.alertName, panel.scopedVars);
    }

    if (props.options.folderId >= 0) {
      params.folderId = props.options.folderId;
    }

    if (props.options.dashboardTitle) {
      params.dashboardQuery = props.options.dashboardTitle;
    }

    if (props.options.dashboardAlerts) {
      params.dashboardId = getDashboardSrv().getCurrent()?.id;
    }

    if (props.options.tags) {
      params.dashboardTag = props.options.tags;
    }

    const alerts: AlertRuleDTO[] = await getBackendSrv().get(
      '/api/alerts',
      params,
      `alert-list-get-current-alert-state-${props.id}`
    );
    let currentAlerts = sortAlerts(
      props.options.sortOrder,
      alerts.map((al) => ({
        ...al,
        stateModel: alertDef.getStateDisplayModel(al.state),
        newStateDateAgo: dateTime(al.newStateDate).locale('en').fromNow(true),
      }))
    );

    if (currentAlerts.length > props.options.maxItems) {
      currentAlerts = currentAlerts.slice(0, props.options.maxItems);
    }
    setNoAlertsMessage(currentAlerts.length === 0 ? 'No alerts' : '');

    return currentAlerts;
  }, [
    props.options.showOptions,
    props.options.stateFilter.alerting,
    props.options.stateFilter.execution_error,
    props.options.stateFilter.no_data,
    props.options.stateFilter.ok,
    props.options.stateFilter.paused,
    props.options.stateFilter.pending,
    props.options.maxItems,
    props.options.tags,
    props.options.dashboardAlerts,
    props.options.dashboardTitle,
    props.options.folderId,
    props.options.alertName,
    props.options.sortOrder,
    props.timeRange,
  ]);

  const recentStateChanges = useAsync(async () => {
    if (props.options.showOptions !== ShowOption.RecentChanges) {
      return;
    }

    const params: any = {
      limit: props.options.maxItems,
      type: 'alert',
      newState: getStateFilter(props.options.stateFilter),
    };
    const currentDashboard = getDashboardSrv().getCurrent();

    if (props.options.dashboardAlerts) {
      params.dashboardId = currentDashboard?.id;
    }

    params.from = dateMath.parse(currentDashboard?.time.from)!.unix() * 1000;
    params.to = dateMath.parse(currentDashboard?.time.to)!.unix() * 1000;

    const data: AnnotationItemDTO[] = await getBackendSrv().get(
      '/api/annotations',
      params,
      `alert-list-get-state-changes-${props.id}`
    );
    const alertHistory = sortAlerts(
      props.options.sortOrder,
      data.map((al) => {
        return {
          ...al,
          time: currentDashboard?.formatDate(al.time, 'MMM D, YYYY HH:mm:ss'),
          stateModel: alertDef.getStateDisplayModel(al.newState),
          info: alertDef.getAlertAnnotationInfo(al),
        };
      })
    );

    setNoAlertsMessage(alertHistory.length === 0 ? 'No alerts in current time range' : '');
    return alertHistory;
  }, [
    props.options.showOptions,
    props.options.maxItems,
    props.options.stateFilter.alerting,
    props.options.stateFilter.execution_error,
    props.options.stateFilter.no_data,
    props.options.stateFilter.ok,
    props.options.stateFilter.paused,
    props.options.stateFilter.pending,
    props.options.dashboardAlerts,
    props.options.sortOrder,
  ]);

  const styles = useStyles2(getStyles);

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      <div className={styles.container}>
        {noAlertsMessage && <div className={styles.noAlertsMessage}>{noAlertsMessage}</div>}
        <section>
          <ol className={styles.alertRuleList}>
            {props.options.showOptions === ShowOption.Current
              ? !currentAlertState.loading &&
                currentAlertState.value &&
                currentAlertState.value!.map((alert) => (
                  <li className={styles.alertRuleItem} key={`alert-${alert.id}`}>
                    <Card href={`${alert.url}?viewPanel=${alert.panelId}`} className={styles.cardContainer}>
                      <Card.Heading>{alert.name}</Card.Heading>
                      <Card.Figure className={cx(styles.alertRuleItemIcon, alert.stateModel.stateClass)}>
                        <Icon name={alert.stateModel.iconClass} size="xl" className={styles.alertIcon} />
                      </Card.Figure>
                      <Card.Meta>
                        <div className={styles.alertRuleItemText}>
                          <span className={alert.stateModel.stateClass}>{alert.stateModel.text}</span>
                          <span className={styles.alertRuleItemTime}> for {alert.newStateDateAgo}</span>
                        </div>
                      </Card.Meta>
                    </Card>
                  </li>
                ))
              : !recentStateChanges.loading &&
                recentStateChanges.value &&
                recentStateChanges.value.map((alert) => (
                  <li className={styles.alertRuleItem} key={`alert-${alert.id}`}>
                    <Card className={styles.cardContainer}>
                      <Card.Heading>{alert.alertName}</Card.Heading>
                      <Card.Figure className={cx(styles.alertRuleItemIcon, alert.stateModel.stateClass)}>
                        <Icon name={alert.stateModel.iconClass} size="xl" />
                      </Card.Figure>
                      <Card.Meta>
                        <span className={cx(styles.alertRuleItemText, alert.stateModel.stateClass)}>
                          {alert.stateModel.text}
                        </span>
                        <span>{alert.time}</span>
                        {alert.info && <span className={styles.alertRuleItemInfo}>{alert.info}</span>}
                      </Card.Meta>
                    </Card>
                  </li>
                ))}
          </ol>
        </section>
      </div>
    </CustomScrollbar>
  );
}

function sortAlerts(sortOrder: SortOrder, alerts: any[]) {
  if (sortOrder === SortOrder.Importance) {
    // @ts-ignore
    return sortBy(alerts, (a) => alertDef.alertStateSortScore[a.state || a.newState]);
  } else if (sortOrder === SortOrder.TimeAsc) {
    return sortBy(alerts, (a) => new Date(a.newStateDate || a.time));
  } else if (sortOrder === SortOrder.TimeDesc) {
    return sortBy(alerts, (a) => new Date(a.newStateDate || a.time)).reverse();
  }

  const result = sortBy(alerts, (a) => (a.name || a.alertName).toLowerCase());
  if (sortOrder === SortOrder.AlphaDesc) {
    result.reverse();
  }

  return result;
}

function getStateFilter(stateFilter: Record<string, boolean>) {
  return Object.entries(stateFilter)
    .filter(([_, val]) => val)
    .map(([key, _]) => key);
}

const getStyles = (theme: GrafanaTheme2) => ({
  cardContainer: css`
    padding: ${theme.spacing(0.5)} 0 ${theme.spacing(0.25)} 0;
    line-height: ${theme.typography.body.lineHeight};
    margin-bottom: 0px;
  `,
  container: css`
    overflow-y: auto;
    height: 100%;
  `,
  alertRuleList: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    list-style-type: none;
  `,
  alertRuleItem: css`
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border-radius: ${theme.shape.borderRadius()};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  alertRuleItemIcon: css`
    display: flex;
    justify-content: center;
    align-items: center;
    width: ${theme.spacing(4)};
    padding: 0 ${theme.spacing(0.5)} 0 ${theme.spacing(0.25)};
    margin-right: 0px;
  `,
  alertRuleItemText: css`
    font-weight: ${theme.typography.fontWeightBold};
    font-size: ${theme.typography.size.sm};
    margin: 0;
  `,
  alertRuleItemTime: css`
    color: ${theme.colors.text.secondary};
    font-weight: normal;
    white-space: nowrap;
  `,
  alertRuleItemInfo: css`
    font-weight: normal;
    flex-grow: 2;
    display: flex;
    align-items: flex-end;
  `,
  noAlertsMessage: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  `,
  alertIcon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
});
