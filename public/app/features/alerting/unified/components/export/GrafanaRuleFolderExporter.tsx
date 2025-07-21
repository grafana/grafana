import { useState } from 'react';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';
import { FolderDTO } from 'app/types/folders';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaRuleFolderExporterProps {
  folder: FolderDTO;
  onClose: () => void;
}

export function GrafanaRuleFolderExporter({ folder, onClose }: GrafanaRuleFolderExporterProps) {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      title={t('alerting.grafana-rule-folder-exporter.title-drawer', 'Export {{folderName}} rules', {
        folderName: folder.title,
      })}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaRuleFolderExportPreview folder={folder} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
}

interface GrafanaRuleFolderExportPreviewProps {
  folder: FolderDTO;
  exportFormat: ExportFormats;
  onClose: () => void;
}

function GrafanaRuleFolderExportPreview({ folder, exportFormat, onClose }: GrafanaRuleFolderExportPreviewProps) {
  const { currentData: exportFolderDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
    folderUid: folder.uid,
    format: exportFormat,
  });

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-rule-folder-export-preview.text-loading', 'Loading....')} />;
  }

  const downloadFileName = `${folder.title}-${folder.uid}`;

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={exportFolderDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
}
