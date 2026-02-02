import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useCallback, useState } from 'react';

import { Button, ClipboardButton, HorizontalGroup, TextArea, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { SaveDashboardFormProps } from '../types';

export const SaveProvisionedDashboardForm = ({ dashboard, onCancel }: Omit<SaveDashboardFormProps, 'isLoading'>) => {
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
        {/* BMC code - inline change */}
        <div>
          <Trans i18nKey={'bmcgrafana.dashboards.save-dashboard.cant-save-provisioned'}>
            This dashboard cannot be saved from the BMC Helix Dashboards because it has been provisioned from another
            source. Copy the JSON or save it to a file below, then you can update your dashboard in the provisioning
            source.
          </Trans>
          {/* BMC code - comment below block */}
          {/* <br />
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
          </i> */}
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
            {/* BMC Change: Next line */}
            <Trans i18nKey={'browse-dashboards.action.cancel-button'}>Cancel</Trans>
          </Button>
          <ClipboardButton icon="copy" getText={() => dashboardJSON}>
            {/* BMC Change: Next line */}
            <Trans i18nKey={'bmcgrafana.dashboards.save-dashboard.copy-json'}>Copy JSON to clipboard</Trans>
          </ClipboardButton>
          <Button type="submit" onClick={saveToFile}>
            {/* BMC Change: Next line */}
            <Trans i18nKey={'bmcgrafana.dashboards.save-dashboard.save-json'}>Save JSON to file</Trans>
          </Button>
        </HorizontalGroup>
      </Stack>
    </>
  );
};

const styles = {
  json: css({
    height: '400px',
    width: '100%',
    overflow: 'auto',
    resize: 'none',
    fontFamily: 'monospace',
  }),
};
