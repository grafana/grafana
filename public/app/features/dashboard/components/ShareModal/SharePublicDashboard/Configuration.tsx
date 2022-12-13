import { css } from '@emotion/css';
import React from 'react';
import { UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { FieldSet, Label, Switch, TimeRangeInput, useStyles2, VerticalGroup } from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { DashboardModel } from 'app/features/dashboard/state';
import { useIsDesktop } from 'app/features/dashboard/utils/screen';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';

import { SharePublicDashboardInputs } from './SharePublicDashboard';

export const Configuration = ({
  disabled,
  dashboard,
  register,
}: {
  disabled: boolean;
  dashboard: DashboardModel;
  register: UseFormRegister<SharePublicDashboardInputs>;
}) => {
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
  const styles = useStyles2(getStyles);
  const isDesktop = useIsDesktop();

  const timeRange = getTimeRange(dashboard.getDefaultTime(), dashboard);

  return (
    <>
      <h4 className={styles.title}>Public dashboard configuration</h4>
      <FieldSet disabled={disabled} className={styles.dashboardConfig}>
        <VerticalGroup spacing="md">
          <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">
            <Label description="The public dashboard uses the default time settings of the dashboard">Time range</Label>
            <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
          </Layout>
          <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">
            <Label>Allow users to change time range</Label>
            <Switch {...register('isTimeRangeEnabled')} data-testid={selectors.EnableTimeRangeSwitch} />
          </Layout>
          <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">
            <Label description="Show annotations on public dashboard">Show annotations</Label>
            <Switch
              {...register('isAnnotationsEnabled')}
              onChange={(e) => {
                const { onChange } = register('isAnnotationsEnabled');
                reportInteraction('grafana_dashboards_annotations_clicked', {
                  action: e.currentTarget.checked ? 'enable' : 'disable',
                });
                onChange(e);
              }}
              data-testid={selectors.EnableAnnotationsSwitch}
            />
          </Layout>
          <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">
            <Label description="Configures whether current dashboard can be available publicly">Enabled</Label>
            <Switch
              {...register('enabledSwitch')}
              onChange={(e) => {
                const { onChange } = register('enabledSwitch');
                reportInteraction('grafana_dashboards_public_enable_clicked', {
                  action: e.currentTarget.checked ? 'enable' : 'disable',
                });
                onChange(e);
              }}
              data-testid={selectors.EnableSwitch}
            />
          </Layout>
        </VerticalGroup>
      </FieldSet>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  dashboardConfig: css`
    margin: ${theme.spacing(0, 0, 3, 0)};
  `,
  timeRange: css`
    margin-bottom: ${theme.spacing(0)};
  `,
  timeRangeDisabledText: css`
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
