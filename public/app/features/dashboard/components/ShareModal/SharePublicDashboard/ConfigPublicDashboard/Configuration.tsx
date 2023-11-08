import React from 'react';
import { UseFormRegister } from 'react-hook-form';

import { TimeRange } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { FieldSet, Label, Switch, TimeRangeInput, VerticalGroup } from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Trans, t } from 'app/core/internationalization';

import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';

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
        <VerticalGroup spacing="md">
          <Layout orientation={1} spacing="xs" justify="space-between">
            <Label
              description={t(
                'configuration.public-dashboard.default-time-range-label-desc',
                'The public dashboard uses the default time range settings of the dashboard'
              )}
            >
              <Trans i18nKey="configuration.public-dashboard.default-time-range">Default time range</Trans>
            </Label>
            <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
          </Layout>
          <Layout orientation={0} spacing="sm">
            <Switch
              {...register('isTimeSelectionEnabled')}
              data-testid={selectors.EnableTimeRangeSwitch}
              onChange={(e) => {
                trackDashboardSharingActionPerType(
                  e.currentTarget.checked ? 'enable_time' : 'disable_time',
                  shareDashboardType.publicDashboard
                );
                onChange('isTimeSelectionEnabled', e.currentTarget.checked);
              }}
            />
            <Label
              description={t(
                'configuration.public-dashboard.time-range-picker-label-desc',
                'Allow viewers to change time range'
              )}
            >
              <Trans i18nKey="configuration.public-dashboard.time-range-picker-enabled">
                Time range picker enabled
              </Trans>
            </Label>
          </Layout>
          <Layout orientation={0} spacing="sm">
            <Switch
              {...register('isAnnotationsEnabled')}
              onChange={(e) => {
                trackDashboardSharingActionPerType(
                  e.currentTarget.checked ? 'enable_annotations' : 'disable_annotations',
                  shareDashboardType.publicDashboard
                );
                onChange('isAnnotationsEnabled', e.currentTarget.checked);
              }}
              data-testid={selectors.EnableAnnotationsSwitch}
            />
            <Label
              description={t(
                'configuration.public-dashboard.show-annotations-label-desc',
                'Show annotations on public dashboard'
              )}
            >
              <Trans i18nKey="configuration.public-dashboard.show-annotations">Show annotations</Trans>
            </Label>
          </Layout>
        </VerticalGroup>
      </FieldSet>
    </>
  );
};
