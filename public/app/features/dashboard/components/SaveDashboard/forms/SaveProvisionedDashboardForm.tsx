import React, { useCallback, useState } from 'react';
import { css } from 'emotion';
import { saveAs } from 'file-saver';
import { Button, HorizontalGroup, stylesFactory, TextArea, useTheme, VerticalGroup } from '@grafana/ui';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { SaveDashboardFormProps } from '../types';
import { AppEvents, GrafanaTheme } from '@grafana/data';
import appEvents from '../../../../../core/app_events';

export const SaveProvisionedDashboardForm: React.FC<SaveDashboardFormProps> = ({ dashboard, onCancel }) => {
  const theme = useTheme();
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
  }, [dashboardJSON]);

  const onCopyToClipboardSuccess = useCallback(() => {
    appEvents.emit(AppEvents.alertSuccess, ['Dashboard JSON copied to clipboard']);
  }, []);

  const styles = getStyles(theme);
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
        <TextArea
          spellCheck={false}
          value={dashboardJSON}
          onChange={e => {
            setDashboardJson(e.currentTarget.value);
          }}
          className={styles.json}
        />
        <HorizontalGroup>
          <CopyToClipboard text={() => dashboardJSON} elType={Button} onSuccess={onCopyToClipboardSuccess}>
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

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    json: css`
      height: 400px;
      width: 100%;
      overflow: auto;
      resize: none;
      font-family: monospace;
    `,
  };
});
