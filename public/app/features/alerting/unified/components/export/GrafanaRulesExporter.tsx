import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaRulesExporterProps {
  onClose: () => void;
}

export function GrafanaRulesExporter({ onClose }: GrafanaRulesExporterProps) {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaRulesExportPreview exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
}

interface GrafanaRulesExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
}

function GrafanaRulesExportPreview({ exportFormat, onClose }: GrafanaRulesExportPreviewProps) {
  const { currentData: rulesDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
    format: exportFormat,
  });

  const downloadFileName = `alert-rules-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={rulesDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
}
