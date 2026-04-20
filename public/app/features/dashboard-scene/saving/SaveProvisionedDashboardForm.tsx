import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { omit } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Trans, t } from '@grafana/i18n';
import {
  Button,
  ClipboardButton,
  Stack,
  CodeEditor,
  Box,
  Label,
  RadioButtonGroup,
  Spinner,
  TextLink,
} from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { ExportFormat } from 'app/features/dashboard/api/types';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { type DashboardChangeInfo } from './shared';

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboardForm({ dashboard, drawer, changeInfo }: Props) {
  const hasK8sMeta = Boolean(dashboard.state.meta.k8s);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    hasK8sMeta ? ExportFormat.V2Resource : ExportFormat.Classic
  );
  const uid = dashboard.state.uid;

  const classicJson = useMemo(() => JSON.stringify(changeInfo.changedSaveModel, null, 2), [changeInfo]);

  const k8sResource = useAsync(async () => {
    if (exportFormat !== ExportFormat.V2Resource || !uid) {
      return null;
    }
    const api = await getDashboardAPI('v2');
    const resource = await api.getDashboardDTO(uid);
    return JSON.stringify(
      {
        apiVersion: resource.apiVersion,
        kind: 'Dashboard',
        metadata: omit(resource.metadata, 'managedFields'),
        spec: resource.spec,
      },
      null,
      2
    );
  }, [exportFormat, uid]);

  const isK8sMode = exportFormat === ExportFormat.V2Resource && hasK8sMeta;
  const displayJson = isK8sMode ? (k8sResource.value ?? '') : classicJson;

  const saveToFile = useCallback(() => {
    const blob = new Blob([displayJson], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, changeInfo.changedSaveModel.title + '-' + new Date().getTime() + '.json');
  }, [changeInfo.changedSaveModel.title, displayJson]);

  const formatOptions = [
    {
      label: t('dashboard-scene.save-provisioned-dashboard-form.format.classic', 'Classic'),
      value: ExportFormat.Classic,
    },
    {
      label: t('dashboard-scene.save-provisioned-dashboard-form.format.v2-resource', 'V2 Resource'),
      value: ExportFormat.V2Resource,
    },
  ];

  const modelLabel = t('dashboard-scene.save-provisioned-dashboard-form.format.model-label', 'Model');

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2} grow={1}>
        <div>
          <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cannot-be-saved">
            This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy
            the JSON or save it to a file below, then you can update your dashboard in the provisioning source.
          </Trans>
          <br />
          <i>
            <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.see-docs">
              See{' '}
              <TextLink href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards" external>
                documentation
              </TextLink>{' '}
              for more information about provisioning.
            </Trans>
          </i>
          <br /> <br />
          <Trans
            i18nKey="dashboard-scene.save-provisioned-dashboard-form.file-path"
            values={{ filePath: dashboard.state.meta.provisionedExternalId }}
          >
            <strong>File path:</strong> {'{{filePath}}'}
          </Trans>
        </div>

        {hasK8sMeta && (
          <QueryOperationRow
            id="provisioned-dashboard-advanced-options"
            index={0}
            title={t('dashboard-scene.save-provisioned-dashboard-form.advanced-options', 'Advanced options')}
            isOpen={false}
          >
            <Box marginTop={2}>
              <Stack gap={1} alignItems="center">
                <Label>{modelLabel}</Label>
                <RadioButtonGroup
                  options={formatOptions}
                  value={exportFormat}
                  onChange={setExportFormat}
                  aria-label={modelLabel}
                />
              </Stack>
            </Box>
          </QueryOperationRow>
        )}

        <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />

        <div className={styles.json}>
          {isK8sMode && k8sResource.loading ? (
            <Spinner />
          ) : (
            <AutoSizer disableWidth>
              {({ height }) => (
                <CodeEditor
                  width="100%"
                  height={height}
                  language="json"
                  showLineNumbers={true}
                  showMiniMap={displayJson.length > 100}
                  value={displayJson}
                  readOnly={true}
                />
              )}
            </AutoSizer>
          )}
        </div>
        <Box paddingTop={2}>
          <Stack gap={2}>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel">Cancel</Trans>
            </Button>
            <ClipboardButton icon="copy" getText={() => displayJson} disabled={isK8sMode && k8sResource.loading}>
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.copy-json-to-clipboard">
                Copy JSON to clipboard
              </Trans>
            </ClipboardButton>
            <Button type="submit" onClick={saveToFile} disabled={isK8sMode && k8sResource.loading}>
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.save-json-to-file">
                Save JSON to file
              </Trans>
            </Button>
          </Stack>
        </Box>
      </Stack>
    </div>
  );
}

const styles = {
  container: css({
    height: '100%',
    display: 'flex',
  }),
  json: css({
    flexGrow: 1,
    maxHeight: '800px',
  }),
};
