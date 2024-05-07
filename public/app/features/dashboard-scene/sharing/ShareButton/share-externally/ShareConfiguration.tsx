import React from 'react';
import { Controller, useForm } from 'react-hook-form';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Label, Stack } from '@grafana/ui';
import { Switch } from '@grafana/ui/src/components/Switch/Switch';

import { Trans } from '../../../../../core/internationalization';
import { publicDashboardApi } from '../../../../dashboard/api/publicDashboardApi';
import { ConfigPublicDashboardForm } from '../../../../dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/ConfigPublicDashboard';
import { DashboardScene } from '../../../scene/DashboardScene';
import { DashboardInteractions } from '../../../utils/interactions';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
export default function ShareConfiguration({ dashboard }: { dashboard: DashboardScene }) {
  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  const { handleSubmit, setValue, register, watch, control } = useForm<Omit<ConfigPublicDashboardForm, 'isPaused'>>({
    defaultValues: {
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeSelectionEnabled: publicDashboard?.timeSelectionEnabled,
    },
  });

  console.log('values', watch());

  return (
    <Stack direction="column" gap={2}>
      <Stack gap={1}>
        <Controller
          render={({ field: { ref, onChange, ...field } }) => (
            <Switch
              {...field}
              data-testid={selectors.EnableTimeRangeSwitch}
              onChange={(e) => {
                onChange(e);
                DashboardInteractions.publicDashboardTimeSelectionChanged({
                  enabled: e.currentTarget.checked,
                });
              }}
              label="Enable time range"
            />
          )}
          control={control}
          name="isTimeSelectionEnabled"
        />
        <Label description="Allow people to change time range">
          <Trans i18nKey="public-dashboard.settings-configuration.time-range-picker-label">Enable time range</Trans>
        </Label>
      </Stack>
      <Stack gap={1}>
        <Controller
          render={({ field: { ref, onChange, ...field } }) => (
            <Switch
              {...field}
              data-testid={selectors.EnableAnnotationsSwitch}
              onChange={(e) => {
                onChange(e);
                DashboardInteractions.publicDashboardAnnotationsSelectionChanged({
                  enabled: e.currentTarget.checked,
                });
              }}
              label="Display annotations"
            />
          )}
          control={control}
          name="isAnnotationsEnabled"
        />
        <Label description="Present annotations on this Dashboard">
          <Trans i18nKey="public-dashboard.settings-configuration.time-range-picker-label">Display annotations</Trans>
        </Label>
      </Stack>
    </Stack>
  );
}
