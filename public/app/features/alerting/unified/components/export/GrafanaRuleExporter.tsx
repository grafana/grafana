import React, { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { RuleExportFormats } from './providers';

interface GrafanaRuleExporterProps {
  onClose: () => void;
  alertUid: string;
}

export const GrafanaRuleExporter = ({ onClose, alertUid }: GrafanaRuleExporterProps) => {
  const [activeTab, setActiveTab] = useState<RuleExportFormats>('yaml');

  return (
    <GrafanaExportDrawer activeTab={activeTab} onTabChange={setActiveTab} onClose={onClose}>
      <GrafanaRuleExportPreview alertUid={alertUid} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};

interface GrafanaRuleExportPreviewProps {
  alertUid: string;
  exportFormat: RuleExportFormats;
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
