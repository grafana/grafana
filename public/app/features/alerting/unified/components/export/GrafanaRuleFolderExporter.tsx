import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { FolderDTO } from '../../../../../types';
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
      title={`Export ${folder.title} rules`}
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
    return <LoadingPlaceholder text="Loading...." />;
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
