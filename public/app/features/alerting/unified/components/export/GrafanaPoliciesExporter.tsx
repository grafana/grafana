import { useState } from 'react';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';
interface GrafanaPoliciesPreviewProps {
  routeName?: string;
  exportFormat: ExportFormats;
  onClose: () => void;
}

const GrafanaPoliciesExporterPreview = ({ routeName = '', exportFormat, onClose }: GrafanaPoliciesPreviewProps) => {
  const { currentData: policiesDefinition = '', isFetching } = alertRuleApi.useExportPoliciesQuery({
    routeName: routeName,
    format: exportFormat,
  });

  const downloadFileName = `policies-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-policies-exporter-preview.text-loading', 'Loading....')} />;
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
  routeName?: string;
  onClose: () => void;
}

export const GrafanaPoliciesExporter = ({ routeName = '', onClose }: GrafanaPoliciesExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaPoliciesExporterPreview exportFormat={activeTab} onClose={onClose} routeName={routeName}/>
    </GrafanaExportDrawer>
  );
};
