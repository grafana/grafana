import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';
interface GrafanaPoliciesPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
}

const GrafanaPoliciesExporterPreview = ({ exportFormat, onClose }: GrafanaPoliciesPreviewProps) => {
  const { currentData: policiesDefinition = '', isFetching } = alertRuleApi.useExportPoliciesQuery({
    format: exportFormat,
  });

  const downloadFileName = `policies-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={policiesDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};

interface GrafanaPoliciesExporterProps {
  onClose: () => void;
}

export const GrafanaPoliciesExporter = ({ onClose }: GrafanaPoliciesExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaPoliciesExporterPreview exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};
