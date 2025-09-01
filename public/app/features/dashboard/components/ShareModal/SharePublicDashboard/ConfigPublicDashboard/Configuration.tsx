import { UseFormRegister } from 'react-hook-form';

import { TimeRange } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Trans, t } from '@grafana/i18n';
import { FieldSet, Label, Switch, TimeRangeInput, Stack } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ConfigPublicDashboardForm } from './ConfigPublicDashboard';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const Configuration = ({
  disabled,
  onChange,
  register,
  timeRange,
}: {
  disabled: boolean;
  onChange: (name: keyof ConfigPublicDashboardForm, value: boolean) => void;
  register: UseFormRegister<ConfigPublicDashboardForm>;
  timeRange: TimeRange;
}) => {
  return (
    <>
      <FieldSet disabled={disabled}>
        <Stack direction="column" gap={1}>
          <Stack direction="column" gap={0.5} justifyContent="space-between">
            <Label
              description={t(
                'public-dashboard.settings-configuration.default-time-range-label-desc',
                'The public dashboard uses the default time range settings of the dashboard'
              )}
            >
              <Trans i18nKey="public-dashboard.settings-configuration.default-time-range-label">
                Default time range
              </Trans>
            </Label>
            <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
          </Stack>
          <Stack direction="row" gap={0.5}>
            <Switch
              {...register('isTimeSelectionEnabled')}
              data-testid={selectors.EnableTimeRangeSwitch}
              onChange={(e) => {
                onChange('isTimeSelectionEnabled', e.currentTarget.checked);
                DashboardInteractions.publicDashboardTimeSelectionChanged({
                  enabled: e.currentTarget.checked,
                });
              }}
            />
            <Label
              description={t(
                'public-dashboard.settings-configuration.time-range-picker-label-desc',
                'Allow viewers to change time range'
              )}
            >
              <Trans i18nKey="public-dashboard.settings-configuration.time-range-picker-label">
                Time range picker enabled
              </Trans>
            </Label>
          </Stack>
          <Stack direction="row" gap={0.5}>
            <Switch
              {...register('isAnnotationsEnabled')}
              onChange={(e) => {
                onChange('isAnnotationsEnabled', e.currentTarget.checked);
                DashboardInteractions.publicDashboardAnnotationsSelectionChanged({
                  enabled: e.currentTarget.checked,
                });
              }}
              data-testid={selectors.EnableAnnotationsSwitch}
            />
            <Label
              description={t(
                'public-dashboard.settings-configuration.show-annotations-label-desc',
                'Show annotations on public dashboard'
              )}
            >
              <Trans i18nKey="public-dashboard.settings-configuration.show-annotations-label">Show annotations</Trans>
            </Label>
          </Stack>
        </Stack>
      </FieldSet>
    </>
  );
};
