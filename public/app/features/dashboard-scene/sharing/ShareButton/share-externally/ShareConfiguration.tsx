import React from 'react';
import { Controller, useForm } from 'react-hook-form';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { sceneGraph } from '@grafana/scenes';
import { FieldSet, Label, Spinner, Stack, TimeRangeInput } from '@grafana/ui';
import { Switch } from '@grafana/ui/src/components/Switch/Switch';
import { Trans } from 'app/core/internationalization';
import { publicDashboardApi, useUpdatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { ConfigPublicDashboardForm } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/ConfigPublicDashboard';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { contextSrv } from '../../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../../types';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

type FormInput = Omit<ConfigPublicDashboardForm, 'isPaused'>;

export default function ShareConfiguration({ dashboard }: { dashboard: DashboardScene }) {
  const [update, { isLoading }] = useUpdatePublicDashboardMutation();

  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const disableForm = isLoading || !publicDashboard?.isEnabled || !hasWritePermissions;
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
    <Stack justifyContent="space-between">
      <form onSubmit={handleSubmit(onUpdate)}>
        <FieldSet disabled={disableForm}>
          <Stack direction="column" gap={2}>
            <Stack justifyContent="space-between" alignItems="center">
              <Label description="It uses the default time range settings of the dashboard">
                <Trans i18nKey="public-dashboard.settings-configuration.default-time-range-label">
                  Default time range
                </Trans>
              </Label>
              <TimeRangeInput value={timeRange.value} disabled onChange={() => {}} />
            </Stack>
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
                    label="Enable time range"
                  />
                )}
                control={control}
                name="isTimeSelectionEnabled"
              />
              <Label description="Allow people to change time range">
                <Trans i18nKey="public-dashboard.settings-configuration.time-range-picker-label">
                  Enable time range
                </Trans>
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
                    label="Display annotations"
                  />
                )}
                control={control}
                name="isAnnotationsEnabled"
              />
              <Label style={{ flex: 1 }} description="Present annotations on this Dashboard">
                <Trans i18nKey="public-dashboard.settings-configuration.time-range-picker-label">
                  Display annotations
                </Trans>
              </Label>
            </Stack>
          </Stack>
        </FieldSet>
      </form>
      {isLoading && <Spinner />}
    </Stack>
  );
}
