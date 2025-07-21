import { useState } from 'react';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaReceiversExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  decrypt: boolean;
}

const GrafanaReceiversExportPreview = ({ decrypt, exportFormat, onClose }: GrafanaReceiversExportPreviewProps) => {
  const { currentData: receiverDefinition = '', isFetching } = alertRuleApi.useExportReceiversQuery({
    decrypt: decrypt,
    format: exportFormat,
  });

  const downloadFileName = `contact-points-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-receivers-export-preview.text-loading', 'Loading....')} />;
  }

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={receiverDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};

interface GrafanaReceiversExporterProps {
  onClose: () => void;
  decrypt: boolean;
}

export const GrafanaReceiversExporter = ({ onClose, decrypt }: GrafanaReceiversExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaReceiversExportPreview decrypt={decrypt} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};
