import { useState } from 'react';
import { useToggle } from 'react-use';

import { t } from '@grafana/i18n';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaReceiversExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
}

const GrafanaReceiversExportPreview = ({ exportFormat, onClose }: GrafanaReceiversExportPreviewProps) => {
  const [decrypt, toggleDecrypt] = useToggle(false);
  const {
    currentData: receiverDefinition,
    isFetching,
    isSuccess,
  } = alertRuleApi.useExportReceiversQuery({
    decrypt: decrypt,
    format: exportFormat,
  });

  const downloadFileName = `contact-points-${new Date().getTime()}`;

  let textContents = '';
  if (isFetching) {
    textContents = t('alerting.grafana-receivers-export-preview.text-loading', 'Loading....');
  } else if (isSuccess) {
    textContents = receiverDefinition;
  }

  return (
    <FileExportPreview
      supportsDecryption={true}
      format={exportFormat}
      textDefinition={textContents}
      downloadFileName={downloadFileName}
      decrypt={decrypt}
      onToggleDecrypt={toggleDecrypt}
      onClose={onClose}
    />
  );
};

interface GrafanaReceiversExporterProps {
  onClose: () => void;
}

export const GrafanaReceiversExporter = ({ onClose }: GrafanaReceiversExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaReceiversExportPreview exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};
