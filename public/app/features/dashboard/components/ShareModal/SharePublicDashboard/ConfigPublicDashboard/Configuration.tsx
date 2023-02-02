import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { FieldSet, Label, Switch, TimeRangeInput, useStyles2, VerticalGroup } from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';

import { useSelector } from '../../../../../../types';
import { useGetPublicDashboardQuery } from '../../../../api/publicDashboardApi';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const Configuration = ({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (name: string, value: boolean) => void;
}) => {
  const styles = useStyles2(getStyles);

  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.uid);

  const timeRange = getTimeRange(dashboard.getDefaultTime(), dashboard);

  return (
    <>
      <FieldSet disabled={disabled} className={styles.dashboardConfig}>
        <VerticalGroup spacing="md">
          <Layout orientation={1} spacing="xs" justify="space-between">
            <Label description="The public dashboard uses the default time range settings of the dashboard">
              Default time range
            </Label>
            <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
          </Layout>
          <Layout orientation={0} spacing="sm">
            <Switch
              name="timeSelectionEnabled"
              value={publicDashboard!.timeSelectionEnabled}
              checked={publicDashboard!.timeSelectionEnabled}
              data-testid={selectors.EnableTimeRangeSwitch}
              onChange={(e) => onChange(e.currentTarget.name, e.currentTarget.checked)}
            />
            <Label description="Allow viewers to change time range">Time range picker enabled</Label>
          </Layout>
          <Layout orientation={0} spacing="sm">
            <Switch
              name="annotationsEnabled"
              value={publicDashboard!.annotationsEnabled}
              checked={publicDashboard!.annotationsEnabled}
              onChange={(e) => {
                // const { onChange } = register('isAnnotationsEnabled');
                reportInteraction('grafana_dashboards_annotations_clicked', {
                  action: e.currentTarget.checked ? 'enable' : 'disable',
                });
                onChange(e.currentTarget.name, e.currentTarget.checked);
              }}
              data-testid={selectors.EnableAnnotationsSwitch}
            />
            <Label description="Show annotations on public dashboard">Show annotations</Label>
          </Layout>
        </VerticalGroup>
      </FieldSet>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  dashboardConfig: css`
    margin: ${theme.spacing(0, 0, 3, 0)};
  `,
});
