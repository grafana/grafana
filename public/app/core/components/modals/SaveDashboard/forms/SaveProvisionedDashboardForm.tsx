import React, { useMemo } from 'react';
import { CustomScrollbar, Forms, HorizontalGroup, JSONFormatter, VerticalGroup } from '@grafana/ui';
import { css } from 'emotion';
import { SaveDashboardFormProps } from '../types';

export const SaveProvisionedDashboardForm: React.FC<SaveDashboardFormProps> = ({ dashboard, onCancel }) => {
  const dashboardJSON = useMemo(() => dashboard.getSaveModelClone(), [dashboard]);
  return (
    <>
      <VerticalGroup spacing="lg">
        <small>
          This dashboard cannot be saved from Grafana's UI since it has been provisioned from another source. Copy the
          JSON or save it to a file below. Then you can update your dashboard in corresponding provisioning source.
          <br />
          <i>
            See{' '}
            <a
              className="external-link"
              href="http://docs.grafana.org/administration/provisioning/#dashboards"
              target="_blank"
            >
              documentation
            </a>{' '}
            for more information about provisioning.
          </i>
        </small>
        <div>
          <strong>File path: </strong> {dashboard.meta.provisionedExternalId}
        </div>
        <div
          className={css`
            padding: 8px 16px;
            background: black;
            height: 400px;
          `}
        >
          <CustomScrollbar>
            <JSONFormatter json={dashboardJSON} open={1} />
          </CustomScrollbar>
        </div>
        <HorizontalGroup>
          <Forms.Button>Copy JSON to clipboard</Forms.Button>
          <Forms.Button>Save JSON file</Forms.Button>
          <Forms.Button variant="secondary" onClick={onCancel}>
            Cancel
          </Forms.Button>
        </HorizontalGroup>
      </VerticalGroup>
    </>
  );
};
