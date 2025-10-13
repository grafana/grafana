import { useState } from 'react';
import { useToggle } from 'react-use';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaReceiverExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  receiverName: string;
}

const GrafanaReceiverExportPreview = ({ receiverName, exportFormat, onClose }: GrafanaReceiverExportPreviewProps) => {
  const [shouldDecrypt, toggleDecrypt] = useToggle(false);

  const {
    currentData: receiverDefinition,
    isFetching,
    isSuccess,
  } = alertRuleApi.useExportReceiverQuery({
    receiverName: receiverName,
    decrypt: shouldDecrypt,
    format: exportFormat,
  });

  const downloadFileName = `cp-${receiverName}-${new Date().getTime()}`;

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
      onClose={onClose}
      decrypt={shouldDecrypt}
      onToggleDecrypt={toggleDecrypt}
    />
  );
};

interface GrafanaReceiverExporterProps {
  onClose: () => void;
  receiverName: string;
}

export const GrafanaReceiverExporter = ({ onClose, receiverName }: GrafanaReceiverExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaReceiverExportPreview receiverName={receiverName} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};
