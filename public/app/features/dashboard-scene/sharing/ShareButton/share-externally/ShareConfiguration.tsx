import { Controller, useForm } from 'react-hook-form';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { sceneGraph } from '@grafana/scenes';
import { FieldSet, Icon, Label, Spinner, Stack, Text, TimeRangeInput, Tooltip } from '@grafana/ui';
import { Switch } from '@grafana/ui/src/components/Switch/Switch';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
import { publicDashboardApi, useUpdatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { ConfigPublicDashboardForm } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/ConfigPublicDashboard';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types';

import { useShareDrawerContext } from '../../ShareDrawer/ShareDrawerContext';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

type FormInput = Omit<ConfigPublicDashboardForm, 'isPaused'>;

export default function ShareConfiguration() {
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
                      data-testid={selectors.EnableTimeRangeSwitch}
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
                <Label description="Allow people to change time range">
                  <Trans i18nKey="public-dashboard.configuration.enable-time-range-label">Enable time range</Trans>
                </Label>
              </Stack>
              <Stack gap={1}>
                <Controller
                  render={({ field: { ref, ...field } }) => (
                    <Switch
                      {...field}
                      data-testid={selectors.EnableAnnotationsSwitch}
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
                <Label style={{ flex: 1 }} description="Present annotations on this Dashboard">
                  <Trans i18nKey="public-dashboard.configuration.display-annotations-label">Display annotations</Trans>
                </Label>
              </Stack>
              <Stack gap={1} alignItems="center">
                <TimeRangeInput value={timeRange.value} showIcon disabled onChange={() => {}} />
                <Tooltip
                  placement="right"
                  content={t(
                    'public-dashboard.configuration.time-range-tooltip',
                    'The shared dashboard uses the default time range settings of the dashboard'
                  )}
                >
                  <Icon name="info-circle" size="sm" />
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
