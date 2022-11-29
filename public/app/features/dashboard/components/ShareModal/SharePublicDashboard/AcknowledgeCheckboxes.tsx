import React from 'react';
import { Control, Controller } from 'react-hook-form';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Checkbox, FieldSet, HorizontalGroup, LinkButton, VerticalGroup } from '@grafana/ui/src';

import { SharePublicDashboardInputs } from './SharePublicDashboard';

export const AcknowledgeCheckboxes = ({
  disabled,
  control,
}: {
  disabled: boolean;
  control: Control<SharePublicDashboardInputs>;
}) => {
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

  return (
    <>
      <p>Before you click Save, please acknowledge the following information:</p>
      <FieldSet disabled={disabled}>
        <VerticalGroup spacing="md">
          <HorizontalGroup spacing="none">
            <Controller
              name="publicAcknowledgment"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  label="Your entire dashboard will be public"
                  data-testid={selectors.WillBePublicCheckbox}
                />
              )}
            />
            <LinkButton
              variant="primary"
              href="https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/"
              target="_blank"
              fill="text"
              icon="info-circle"
              rel="noopener noreferrer"
              tooltip="Learn more about public dashboards"
            />
          </HorizontalGroup>
          <HorizontalGroup spacing="none">
            <Controller
              name="dataSourcesAcknowledgment"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  label="Publishing currently only works with a subset of datasources"
                  data-testid={selectors.LimitedDSCheckbox}
                />
              )}
            />
            <LinkButton
              variant="primary"
              href="https://grafana.com/docs/grafana/latest/datasources/"
              target="_blank"
              fill="text"
              icon="info-circle"
              rel="noopener noreferrer"
              tooltip="Learn more about public datasources"
            />
          </HorizontalGroup>
          <HorizontalGroup spacing="none">
            <Controller
              name="usageAcknowledgment"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  label="Making your dashboard public will cause queries to run each time the dashboard is viewed which may increase costs"
                  data-testid={selectors.CostIncreaseCheckbox}
                />
              )}
            />
            <LinkButton
              variant="primary"
              href="https://grafana.com/docs/grafana/latest/enterprise/query-caching/"
              target="_blank"
              fill="text"
              icon="info-circle"
              rel="noopener noreferrer"
              tooltip="Learn more about query caching"
            />
          </HorizontalGroup>
        </VerticalGroup>
      </FieldSet>
    </>
  );
};
