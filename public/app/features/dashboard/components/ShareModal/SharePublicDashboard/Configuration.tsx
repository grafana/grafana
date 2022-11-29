import { css } from '@emotion/css';
import React from 'react';
import { Control, Controller } from 'react-hook-form';

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
  control,
}: {
  disabled: boolean;
  dashboard: DashboardModel;
  control: Control<SharePublicDashboardInputs>;
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
            <Label>Allow viewers to change time ranges</Label>
            <Controller
              name="isTimePickerEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  {...field}
                  data-testid={selectors.EnableAnnotationsSwitch}
                  // value={isTimePickerEnabled}
                  onChange={() => {
                    console.log('te cabe', control.validFieldsRef.current.isTimePickerEnabled);
                    reportInteraction('grafana_dashboards_annotations_clicked', {
                      action: field.value ? 'disable' : 'enable',
                    });
                    field.onChange();
                  }}
                />
              )}
            />
            {/*<TimeRangeInput value={timeRange} disabled onChange={() => {}} />*/}
          </Layout>
          {/*{!isTimePickerEnabled && (*/}
          {/*  <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">*/}
          {/*    <p className={styles.timeRangeDisabledText}>*/}
          {/*      The public dashboard will use the default time settings of the dashboard*/}
          {/*    </p>*/}
          {/*    <TimeRangeInput value={timeRange} disabled onChange={() => {}} />*/}
          {/*  </Layout>*/}
          {/*)}*/}

          <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">
            <Label description="Show annotations on public dashboard">Show annotations</Label>
            <Controller
              name="isAnnotationsEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  {...field}
                  data-testid={selectors.EnableAnnotationsSwitch}
                  // value={isAnnotationsEnabled}
                  // onChange={() => {
                  //   reportInteraction('grafana_dashboards_annotations_clicked', {
                  //     action: isAnnotationsEnabled ? 'disable' : 'enable',
                  //   });
                  //   onToggleAnnotations();
                  // }}
                />
              )}
            />
          </Layout>
          <Layout orientation={isDesktop ? 0 : 1} spacing="xs" justify="space-between">
            <Label description="Configures whether current dashboard can be available publicly">Enabled</Label>
            <Controller
              name="enabledSwitch.isEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  {...field}
                  data-testid={selectors.EnableSwitch}
                  // value={isAnnotationsEnabled}
                  // onChange={() => {
                  //     reportInteraction('grafana_dashboards_public_enable_clicked', {
                  //   action: isPubDashEnabled ? 'disable' : 'enable',
                  // });
                  //
                  //   onToggleEnabled();
                  // }}
                />
              )}
            />
            {/*<Switch*/}
            {/*  data-testid={selectors.EnableSwitch}*/}
            {/*  value={isPubDashEnabled}*/}
            {/*  onChange={() => {*/}
            {/*    reportInteraction('grafana_dashboards_public_enable_clicked', {*/}
            {/*      action: isPubDashEnabled ? 'disable' : 'enable',*/}
            {/*    });*/}

            {/*    onToggleEnabled();*/}
            {/*  }}*/}
            {/*/>*/}
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
