import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaReceiverExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  receiverName: string;
  decrypt: boolean;
}

const GrafanaReceiverExportPreview = ({
  receiverName,
  decrypt,
  exportFormat,
  onClose,
}: GrafanaReceiverExportPreviewProps) => {
  const { currentData: receiverDefinition = '', isFetching } = alertRuleApi.useExportReceiverQuery({
    receiverName: receiverName,
    decrypt: decrypt,
    format: exportFormat,
  });

  const downloadFileName = `cp-${receiverName}-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-receiver-export-preview.text-loading', 'Loading....')} />;
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

interface GrafanaReceiverExporterProps {
  onClose: () => void;
  receiverName: string;
  decrypt: boolean;
}

export const GrafanaReceiverExporter = ({ onClose, receiverName, decrypt }: GrafanaReceiverExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaReceiverExportPreview
        receiverName={receiverName}
        decrypt={decrypt}
        exportFormat={activeTab}
        onClose={onClose}
      />
    </GrafanaExportDrawer>
  );
};
