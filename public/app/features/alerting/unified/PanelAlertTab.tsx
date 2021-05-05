import { css } from '@emotion/css';
import { GrafanaTheme2, rangeUtil } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import React, { FC, useMemo } from 'react';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const PanelAlertTab: FC<Props> = ({ dashboard, panel }) => {
  const styles = useStyles2(getStyles);
  const { targets, datasource: dashboardDatasource } = panel;

  const relativeTimeRange = rangeUtil.timeRangeToRelative(rangeUtil.convertRawToRange(dashboard.time));

  const possibleAlertingQueries = useMemo((): GrafanaQuery[] => {
    if (targets) {
      return targets.reduce<GrafanaQuery[]>((queries, target) => {
        const datasource = getDataSourceSrv().getInstanceSettings(target.datasource || dashboardDatasource);
        if (datasource && datasource.meta.alerting) {
          const newQuery: GrafanaQuery = {
            refId: target.refId,
            queryType: target.queryType ?? '',
            relativeTimeRange,
            datasourceUid: datasource.uid,
            model: target,
          };
          return [...queries, newQuery];
        }
        return queries;
      }, []);
    }
    return [];
  }, [targets, dashboardDatasource, relativeTimeRange]);

  console.log(possibleAlertingQueries);

  return (
    <div className={styles.noRulesWrapper}>
      <p>There are no alert rules linked to this panel.</p>
      <LinkButton icon="bell">Create alert rule from this panel</LinkButton>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  noRulesWrapper: css`
    margin: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(3)};
  `,
});
