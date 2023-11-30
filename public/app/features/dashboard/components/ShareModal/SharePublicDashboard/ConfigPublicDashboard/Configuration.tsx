import React from 'react';
import { UseFormRegister } from 'react-hook-form';

import { TimeRange } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime';
import { FieldSet, Label, Switch, TimeRangeInput, VerticalGroup } from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';

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
            <Label description="The public dashboard uses the default time range settings of the dashboard">
              Default time range
            </Label>
            <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
          </Layout>
          <Layout orientation={0} spacing="sm">
            <Switch
              {...register('isTimeSelectionEnabled')}
              data-testid={selectors.EnableTimeRangeSwitch}
              onChange={(e) => {
                onChange('isTimeSelectionEnabled', e.currentTarget.checked);
                reportInteraction('dashboards_sharing_public_time_picker_clicked', {
                  enabled: e.currentTarget.checked,
                });
              }}
            />
            <Label description="Allow viewers to change time range">Time range picker enabled</Label>
          </Layout>
          <Layout orientation={0} spacing="sm">
            <Switch
              {...register('isAnnotationsEnabled')}
              onChange={(e) => {
                onChange('isAnnotationsEnabled', e.currentTarget.checked);
                reportInteraction('dashboards_sharing_public_annotations_clicked', {
                  enabled: e.currentTarget.checked,
                });
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
