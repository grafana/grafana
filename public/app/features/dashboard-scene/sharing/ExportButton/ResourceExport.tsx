import { useMemo } from 'react';
import { AsyncState } from 'react-use/lib/useAsync';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Alert, Icon, Label, RadioButtonGroup, Stack, Switch, Box, Tooltip } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { ExportableResource } from '../ShareExportTab';

export enum ExportMode {
  Classic = 'classic',
  V1Resource = 'v1-resource',
  V2Resource = 'v2-resource',
}

interface Props {
  dashboardJson: AsyncState<{
    json: Dashboard | DashboardJson | DashboardV2Spec | ExportableResource | { error: unknown };
    hasLibraryPanels?: boolean;
    initialSaveModelVersion: 'v1' | 'v2';
  }>;
  isSharingExternally: boolean;
  exportMode: ExportMode;
  isViewingYAML: boolean;
  onExportModeChange: (mode: ExportMode) => void;
  onShareExternallyChange: () => void;
  onViewYAML: () => void;
}

const selector = e2eSelectors.pages.ExportDashboardDrawer.ExportAsJson;

export function ResourceExport({
  dashboardJson,
  isSharingExternally,
  exportMode,
  isViewingYAML,
  onExportModeChange,
  onShareExternallyChange,
  onViewYAML,
}: Props) {
  const hasLibraryPanels = dashboardJson.value?.hasLibraryPanels;
  const initialSaveModelVersion = dashboardJson.value?.initialSaveModelVersion;
  const isV2Dashboard =
    dashboardJson.value?.json && 'spec' in dashboardJson.value.json && 'elements' in dashboardJson.value.json.spec;
  const showV2LibPanelAlert = isV2Dashboard && isSharingExternally && hasLibraryPanels;

  const switchExportLabel =
    exportMode === ExportMode.V2Resource
      ? t('dashboard-scene.resource-export.share-externally', 'Share dashboard with another instance')
      : t('share-modal.export.share-externally-label', 'Export for sharing externally');
  const switchExportTooltip = t(
    'dashboard-scene.resource-export.share-externally-tooltip',
    'Replaces datasource names with their default values and removes references that are unique to this instance'
  );
  const switchExportModeLabel = t('export.json.export-mode', 'Model');
  const switchExportFormatLabel = t('export.json.export-format', 'Format');

  const exportResourceOptions = useMemo(() => {
    const classicOption = {
      label: t('dashboard-scene.resource-export.label.classic', 'Classic'),
      value: ExportMode.Classic,
    };
    const v1Option = {
      label: t('dashboard-scene.resource-export.label.v1-resource', 'V1 Resource'),
      value: ExportMode.V1Resource,
    };
    const v2Option = {
      label: t('dashboard-scene.resource-export.label.v2-resource', 'V2 Resource'),
      value: ExportMode.V2Resource,
    };

    if (initialSaveModelVersion === 'v1') {
      return [classicOption, v1Option, v2Option];
    }
    return [v2Option, v1Option];
  }, [initialSaveModelVersion]);

  return (
    <>
      <QueryOperationRow
        id="Advanced options"
        index={0}
        title={t('dashboard-scene.resource-export.label.advanced-options', 'Advanced options')}
        isOpen={false}
      >
        <Box marginTop={2}>
          <Stack gap={1} direction="column">
            <Stack gap={1} alignItems="center">
              <Label>{switchExportModeLabel}</Label>
              <RadioButtonGroup
                options={exportResourceOptions}
                value={exportMode}
                onChange={(value) => onExportModeChange(value)}
              />
            </Stack>

            {exportMode !== ExportMode.Classic && (
              <Stack gap={1} alignItems="center">
                <Label>{switchExportFormatLabel}</Label>
                <RadioButtonGroup
                  options={[
                    { label: t('dashboard-scene.resource-export.label.json', 'JSON'), value: 'json' },
                    { label: t('dashboard-scene.resource-export.label.yaml', 'YAML'), value: 'yaml' },
                  ]}
                  value={isViewingYAML ? 'yaml' : 'json'}
                  onChange={onViewYAML}
                />
              </Stack>
            )}
          </Stack>
        </Box>
      </QueryOperationRow>

      {(isV2Dashboard ||
        exportMode === ExportMode.Classic ||
        (initialSaveModelVersion === 'v2' && exportMode === ExportMode.V1Resource)) && (
        <Stack gap={1} alignItems="start">
          <Label>
            <Stack gap={0.5} alignItems="center">
              <Tooltip content={switchExportTooltip} placement="bottom">
                <Icon name="info-circle" size="sm" />
              </Tooltip>
              {switchExportLabel}
            </Stack>
          </Label>
          <Switch
            label={switchExportLabel}
            value={isSharingExternally}
            onChange={onShareExternallyChange}
            data-testid={selector.exportExternallyToggle}
          />
        </Stack>
      )}

      {showV2LibPanelAlert && (
        <Alert
          title={t(
            'dashboard-scene.save-dashboard-form.schema-v2-library-panels-export-title',
            'Library panels will be converted to regular panels'
          )}
          severity="warning"
          topSpacing={2}
          data-testid={selector.libraryPanelsAlert}
        >
          <Trans i18nKey="dashboard-scene.save-dashboard-form.schema-v2-library-panels-export">
            Due to limitations in the new dashboard schema (V2), library panels will be converted to regular panels with
            embedded content during external export.
          </Trans>
        </Alert>
      )}
    </>
  );
}
