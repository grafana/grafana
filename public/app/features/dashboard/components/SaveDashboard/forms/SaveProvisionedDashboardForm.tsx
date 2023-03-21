import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import React, { useCallback, useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, ClipboardButton, HorizontalGroup, TextArea } from '@grafana/ui';

import { SaveDashboardFormProps } from '../types';

export const SaveProvisionedDashboardForm = ({ dashboard, onCancel }: SaveDashboardFormProps) => {
  const [dashboardJSON, setDashboardJson] = useState(() => {
    const clone = dashboard.getSaveModelClone();
    delete clone.id;
    return JSON.stringify(clone, null, 2);
  });

  const saveToFile = useCallback(() => {
    const blob = new Blob([dashboardJSON], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, dashboard.title + '-' + new Date().getTime() + '.json');
  }, [dashboard.title, dashboardJSON]);

  return (
    <>
      <Stack direction="column" gap={2}>
        <div>
          This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy
          the JSON or save it to a file below, then you can update your dashboard in the provisioning source.
          <br />
          <i>
            See{' '}
            <a
              className="external-link"
              href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards"
              target="_blank"
              rel="noreferrer"
            >
              documentation
            </a>{' '}
            for more information about provisioning.
          </i>
          <br /> <br />
          <strong>File path: </strong> {dashboard.meta.provisionedExternalId}
        </div>
        <TextArea
          spellCheck={false}
          value={dashboardJSON}
          onChange={(e) => {
            setDashboardJson(e.currentTarget.value);
          }}
          className={styles.json}
        />
        <HorizontalGroup>
          <Button variant="secondary" onClick={onCancel} fill="outline">
            Cancel
          </Button>
          <ClipboardButton icon="copy" getText={() => dashboardJSON}>
            Copy JSON to clipboard
          </ClipboardButton>
          <Button type="submit" onClick={saveToFile}>
            Save JSON to file
          </Button>
        </HorizontalGroup>
      </Stack>
    </>
  );
};

const styles = {
  json: css`
    height: 400px;
    width: 100%;
    overflow: auto;
    resize: none;
    font-family: monospace;
  `,
};
