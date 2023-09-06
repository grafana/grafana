import React, { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats } from './providers';


interface GrafanaRuleExportPreviewProps {
  alertUid: string;
  exportFormat: ExportFormats;
  onClose: () => void;
}

const GrafanaRuleExportPreview = ({ alertUid, exportFormat, onClose }: GrafanaRuleExportPreviewProps) => {
  const { currentData: ruleTextDefinition = '', isFetching } = alertRuleApi.useExportRuleQuery({
    uid: alertUid,
    format: exportFormat,
  });

  const downloadFileName = `${alertUid}-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={ruleTextDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};

interface GrafanaRulerExporterProps {
  onClose: () => void;
  alertUid: string
}


export const GrafanaRuleExporter = ({ onClose, alertUid }: GrafanaRulerExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer activeTab={activeTab} onTabChange={setActiveTab} onClose={onClose}>
      <GrafanaRuleExportPreview alertUid={alertUid} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
}
