import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Checkbox, FieldSet, HorizontalGroup, LinkButton, VerticalGroup } from '@grafana/ui/src';

export const AcknowledgeCheckboxes = ({
  disabled,
  acknowledgements,
  onAcknowledge,
}: {
  disabled: boolean;
  acknowledgements: {
    publicDashboard: boolean;
    dataSources: boolean;
    usage: boolean;
  };
  onAcknowledge: (key: string, val: boolean) => void;
}) => {
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

  return (
    <FieldSet disabled={disabled}>
      <VerticalGroup spacing="md">
        <Checkbox
          label="Your entire dashboard will be public"
          value={acknowledgements.publicDashboard}
          data-testid={selectors.WillBePublicCheckbox}
          onChange={(e) => onAcknowledge('public', e.currentTarget.checked)}
        />
        <HorizontalGroup spacing="none">
          <Checkbox
            label="Publishing currently only works with a subset of datasources"
            value={acknowledgements.dataSources}
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
  );
};
