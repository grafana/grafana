import React, { useCallback, useMemo } from 'react';
import { css } from 'emotion';
import { saveAs } from 'file-saver';
import { CustomScrollbar, Button, HorizontalGroup, JSONFormatter, VerticalGroup } from '@grafana/ui';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { SaveDashboardFormProps } from '../types';

export const SaveProvisionedDashboardForm: React.FC<SaveDashboardFormProps> = ({ dashboard, onCancel }) => {
  const dashboardJSON = useMemo(() => {
    const clone = dashboard.getSaveModelClone();
    delete clone.id;
    return clone;
  }, [dashboard]);

  const getClipboardText = useCallback(() => {
    return JSON.stringify(dashboardJSON, null, 2);
  }, [dashboard]);

  const saveToFile = useCallback(() => {
    const blob = new Blob([JSON.stringify(dashboardJSON, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, dashboard.title + '-' + new Date().getTime() + '.json');
  }, [dashboardJSON]);

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
          <CopyToClipboard text={getClipboardText} elType={Button}>
            Copy JSON to clipboard
          </CopyToClipboard>
          <Button onClick={saveToFile}>Save JSON to file</Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </HorizontalGroup>
      </VerticalGroup>
    </>
  );
};
