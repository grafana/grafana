import { AsyncState } from 'react-use/lib/useAsync';

import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Alert, Label, RadioButtonGroup, Stack, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { ExportMode, ExportableResource } from '../ShareExportTab';

interface Props {
  dashboardJson: AsyncState<{
    json: Dashboard | DashboardJson | DashboardV2Spec | ExportableResource | { error: unknown };
    hasLibraryPanels?: boolean;
  }>;
  isSharingExternally: boolean;
  exportMode: ExportMode;
  isViewingYAML: boolean;
  onExportModeChange: (mode: ExportMode) => void;
  onShareExternallyChange: () => void;
  onViewYAML: () => void;
}

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
  const isV2Dashboard =
    dashboardJson.value?.json && 'spec' in dashboardJson.value.json && 'elements' in dashboardJson.value.json.spec;
  const showV2LibPanelAlert = isV2Dashboard && isSharingExternally && hasLibraryPanels;

  const switchExportLabel = t('export.json.export-target-label', 'Export target');
  const switchExportModeLabel = t('export.json.export-mode', 'Export mode');
  const switchExportFormatLabel = t('export.json.export-format', 'Export format');

  return (
    <Stack gap={2} direction="column">
      <Stack gap={1} direction="column">
        <Stack alignItems="center">
          <Label>{switchExportModeLabel}</Label>
          <RadioButtonGroup
            options={[
              { label: 'Classic', value: ExportMode.Classic },
              { label: 'V1 Resource', value: ExportMode.V1Resource },
              { label: 'V2 Resource', value: ExportMode.V2Resource },
            ]}
            value={isV2Dashboard ? ExportMode.V2Resource : exportMode}
            onChange={(value) => onExportModeChange(value)}
            disabled={isV2Dashboard}
          />
        </Stack>
        <Stack gap={1} alignItems="center">
          <Label>{switchExportLabel}</Label>
          <RadioButtonGroup
            options={[
              { label: 'Internal', value: 'internal' },
              { label: 'External', value: 'external' },
            ]}
            value={isSharingExternally ? 'external' : 'internal'}
            onChange={onShareExternallyChange}
          />
        </Stack>
        <Stack gap={1} alignItems="center">
          <Label>{switchExportFormatLabel}</Label>
          <RadioButtonGroup
            options={[
              { label: 'JSON', value: 'json' },
              { label: 'YAML', value: 'yaml' },
            ]}
            value={isViewingYAML && exportMode !== ExportMode.Classic ? 'yaml' : 'json'}
            onChange={onViewYAML}
            disabled={exportMode === ExportMode.Classic}
          />
        </Stack>
      </Stack>

      {showV2LibPanelAlert && (
        <Alert
          title={t(
            'dashboard-scene.save-dashboard-form.schema-v2-library-panels-export-title',
            'Dashboard Schema V2 does not support exporting library panels to be used in another instance yet'
          )}
          severity="warning"
        >
          <Trans i18nKey="dashboard-scene.save-dashboard-form.schema-v2-library-panels-export">
            The dynamic dashboard functionality is experimental, and has not full feature parity with current dashboards
            behaviour. It is based on a new schema format, that does not support library panels. This means that when
            exporting the dashboard to use it in another instance, we will not include library panels. We intend to
            support them as we progress in the feature{' '}
            <TextLink external href="https://grafana.com/docs/release-life-cycle/">
              life cycle
            </TextLink>
            .
          </Trans>
        </Alert>
      )}
    </Stack>
  );
}
