import { css, cx } from '@emotion/css';
import { Controller, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { FieldSet, Icon, Label, Spinner, Stack, Switch, Text, TimeRangeLabel, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { publicDashboardApi, useUpdatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { ConfigPublicDashboardForm } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/ConfigPublicDashboard';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types/accessControl';

import { useShareDrawerContext } from '../../ShareDrawer/ShareDrawerContext';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally.Configuration;

type FormInput = Omit<ConfigPublicDashboardForm, 'isPaused'>;

export default function ShareConfiguration() {
  const styles = useStyles2(getStyles);
  const { dashboard } = useShareDrawerContext();
  const [update, { isLoading }] = useUpdatePublicDashboardMutation();

  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const disableForm = isLoading || !hasWritePermissions;
  const timeRangeState = sceneGraph.getTimeRange(dashboard);
  const timeRange = timeRangeState.useState();

  const { handleSubmit, setValue, control } = useForm<FormInput>({
    defaultValues: {
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeSelectionEnabled: publicDashboard?.timeSelectionEnabled,
    },
  });

  const onChange = async (name: keyof FormInput, value: boolean) => {
    setValue(name, value);
    await handleSubmit((data) => onUpdate({ ...data, [name]: value }))();
  };

  const onUpdate = (data: FormInput) => {
    const { isAnnotationsEnabled, isTimeSelectionEnabled } = data;

    update({
      dashboard: dashboard,
      payload: {
        ...publicDashboard!,
        annotationsEnabled: isAnnotationsEnabled,
        timeSelectionEnabled: isTimeSelectionEnabled,
      },
    });
  };

  return (
    <Stack direction="column" gap={2}>
      <Text element="p">
        <Trans i18nKey="public-dashboard.configuration.settings-label">Settings</Trans>
      </Text>
      <Stack justifyContent="space-between">
        <form onSubmit={handleSubmit(onUpdate)}>
          <FieldSet disabled={disableForm}>
            <Stack direction="column" gap={2}>
              <Stack gap={1}>
                <Controller
                  render={({ field: { ref, ...field } }) => (
                    <Switch
                      {...field}
                      data-testid={selectors.enableTimeRangeSwitch}
                      onChange={(e) => {
                        DashboardInteractions.publicDashboardTimeSelectionChanged({
                          enabled: e.currentTarget.checked,
                        });
                        onChange('isTimeSelectionEnabled', e.currentTarget.checked);
                      }}
                      label={t('public-dashboard.configuration.enable-time-range-label', 'Enable time range')}
                    />
                  )}
                  control={control}
                  name="isTimeSelectionEnabled"
                />
                <Label
                  description={t(
                    'public-dashboard.configuration.enable-time-range-description',
                    'Allow people to change time range'
                  )}
                >
                  <Trans i18nKey="public-dashboard.configuration.enable-time-range-label">Enable time range</Trans>
                </Label>
              </Stack>
              <Stack gap={1}>
                <Controller
                  render={({ field: { ref, ...field } }) => (
                    <Switch
                      {...field}
                      data-testid={selectors.enableAnnotationsSwitch}
                      onChange={(e) => {
                        DashboardInteractions.publicDashboardAnnotationsSelectionChanged({
                          enabled: e.currentTarget.checked,
                        });
                        onChange('isAnnotationsEnabled', e.currentTarget.checked);
                      }}
                      label={t('public-dashboard.configuration.display-annotations-label', 'Display annotations')}
                    />
                  )}
                  control={control}
                  name="isAnnotationsEnabled"
                />
                <Label
                  style={{ flex: 1 }}
                  description={t(
                    'public-dashboard.configuration.display-annotations-description',
                    'Present annotations on this dashboard'
                  )}
                >
                  <Trans i18nKey="public-dashboard.configuration.display-annotations-label">Display annotations</Trans>
                </Label>
              </Stack>
              <Stack gap={1} alignItems="flex-start">
                <div className={styles.timeRange}>
                  <Trans i18nKey="public-dashboard.configuration.time-range-label">Time range</Trans>
                </div>
                <div className={cx(styles.timeRange, styles.timeRangeValue)}>
                  <TimeRangeLabel value={timeRange.value} />
                </div>
                <Tooltip
                  placement="right"
                  content={t(
                    'public-dashboard.configuration.time-range-tooltip',
                    'The shared dashboard uses the default time range settings of the dashboard'
                  )}
                >
                  <Icon name="info-circle" size="md" />
                </Tooltip>
              </Stack>
            </Stack>
          </FieldSet>
        </form>
        {isLoading && <Spinner />}
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  timeRange: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.bodySmall.fontWeight,
  }),
  timeRangeValue: css({
    color: theme.colors.text.secondary,
  }),
});
