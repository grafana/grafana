import { css, cx } from '@emotion/css';
import { saveAs } from 'file-saver';
import { omit } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  ClipboardButton,
  Stack,
  CodeEditor,
  Box,
  Label,
  RadioButtonGroup,
  Spinner,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { ExportFormat } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneSerializer } from '../serialization/DashboardSceneSerializer';
import { convertSpecToWireFormat } from '../serialization/transformationCompat';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveDashboardFormCommonOptions } from './SaveDashboardForm';
import { type DashboardChangeInfo } from './shared';

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveProvisionedDashboardForm({ dashboard, drawer, changeInfo }: Props) {
  const styles = useStyles2(getStyles);
  const hasK8sMeta = Boolean(dashboard.state.meta.k8s);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    hasK8sMeta ? ExportFormat.V2Resource : ExportFormat.Classic
  );
  const uid = dashboard.state.uid;

  const { changedSaveModel } = changeInfo;
  const classicJson = useMemo(() => {
    // The changed model is a v2 spec whenever the scene serializes to v2, but this JSON is pasted
    // back into file-based provisioning, which only accepts v1. Ask the v1 serializer for the same
    // save model a non-provisioned dashboard produces, so both paths stay in step and the unsaved
    // local edits survive.
    const classicModel = isDashboardV2Spec(changedSaveModel)
      ? getDashboardSceneSerializer('v1').getSaveModel(dashboard)
      : changedSaveModel;

    return JSON.stringify(classicModel, null, 2);
  }, [changedSaveModel, dashboard]);

  const k8sResource = useAsync(async () => {
    if (exportFormat !== ExportFormat.V2Resource || !uid) {
      return null;
    }
    const api = await getDashboardAPI('v2');
    const resource = await api.getDashboardDTO(uid);

    // if the local edits are already in v2 form, reflect them in the displayed resource
    const spec = isDashboardV2Spec(changedSaveModel) ? convertSpecToWireFormat(changedSaveModel) : resource.spec;

    return JSON.stringify(
      {
        apiVersion: resource.apiVersion,
        kind: 'Dashboard',
        metadata: omit(resource.metadata, 'managedFields'),
        spec,
      },
      null,
      2
    );
  }, [exportFormat, uid, changedSaveModel]);

  const isK8sMode = exportFormat === ExportFormat.V2Resource && hasK8sMeta;
  const displayJson = isK8sMode ? (k8sResource.value ?? '') : classicJson;
  const isLossyClassicModel = !isK8sMode && isDashboardV2Spec(changedSaveModel);

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

        {isLossyClassicModel && (
          <Alert
            title=""
            severity="warning"
            bottomSpacing={0}
            className={cx(styles.warning, hasK8sMeta && styles.warningBelowOptions)}
          >
            <Trans i18nKey="dashboard-scene.resource-export.classic-v2-warning">
              This dashboard uses the V2 schema. Features like tabs and conditional rendering cannot be represented in
              the classic format and may be lost.
            </Trans>
          </Alert>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      display: 'flex',
    }),
    json: css({
      flexGrow: 1,
      maxHeight: '800px',
    }),
    // Alert's wrapper sets flexGrow: 1, which in this column layout makes it swallow all the
    // free space instead of the JSON editor below it.
    warning: css({
      flexGrow: 0,
    }),
    // The advanced options row adds its own bottom margin on top of the Stack's gap. Drop one of
    // them so the warning sits as close to the controls as it does in the export drawer.
    warningBelowOptions: css({
      marginTop: theme.spacing(-2),
    }),
  };
}
