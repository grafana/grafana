import React, { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, jsonAndYamlGrafanaExportProviders } from './providers';

interface GrafanaReceiversExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  decrypt: string;
}

const GrafanaReceiversExportPreview = ({ decrypt, exportFormat, onClose }: GrafanaReceiversExportPreviewProps) => {
  const { currentData: receiverDefinition = '', isFetching } = alertRuleApi.useExportReceiversQuery({
    decrypt: decrypt,
    format: exportFormat,
  });

  const downloadFileName = `contact-points-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
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
  decrypt: string;
}

export const GrafanaReceiversExporter = ({ onClose, decrypt }: GrafanaReceiversExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer activeTab={activeTab} onTabChange={setActiveTab} onClose={onClose} formatProviders={jsonAndYamlGrafanaExportProviders}>
      <GrafanaReceiversExportPreview decrypt={decrypt} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};
