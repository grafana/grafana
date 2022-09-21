import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Checkbox, FieldSet, HorizontalGroup, LinkButton, VerticalGroup } from '@grafana/ui/src';

import { Acknowledgements } from './SharePublicDashboardUtils';

export const AcknowledgeCheckboxes = ({
  disabled,
  acknowledgements,
  onAcknowledge,
}: {
  disabled: boolean;
  acknowledgements: Acknowledgements;
  onAcknowledge: (key: string, val: boolean) => void;
}) => {
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

  return (
    <>
      <p>Before you click Save, please acknowledge the following information:</p>
      <FieldSet disabled={disabled}>
        <VerticalGroup spacing="md">
          <HorizontalGroup spacing="none">
            <Checkbox
              label="Your entire dashboard will be public"
              value={acknowledgements.public}
              data-testid={selectors.WillBePublicCheckbox}
              onChange={(e) => onAcknowledge('public', e.currentTarget.checked)}
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
            <Checkbox
              label="Publishing currently only works with a subset of datasources"
              value={acknowledgements.datasources}
              data-testid={selectors.LimitedDSCheckbox}
              onChange={(e) => onAcknowledge('datasources', e.currentTarget.checked)}
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
            <Checkbox
              label="Making your dashboard public will cause queries to run each time the dashboard is viewed which may increase costs"
              value={acknowledgements.usage}
              data-testid={selectors.CostIncreaseCheckbox}
              onChange={(e) => onAcknowledge('usage', e.currentTarget.checked)}
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
