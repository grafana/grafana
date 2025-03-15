import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaRuleExportPreviewProps {
  alertUid: string;
  exportFormat: ExportFormats;
  onClose: () => void;
}

const GrafanaRuleExportPreview = ({ alertUid, exportFormat, onClose }: GrafanaRuleExportPreviewProps) => {
  const { currentData: ruleTextDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
    ruleUid: alertUid,
    format: exportFormat,
  });

  const downloadFileName = `${alertUid}-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-rule-export-preview.text-loading', 'Loading....')} />;
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
  alertUid: string;
}

export const GrafanaRuleExporter = ({ onClose, alertUid }: GrafanaRulerExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaRuleExportPreview alertUid={alertUid} exportFormat={activeTab} onClose={onClose} />
    </GrafanaExportDrawer>
  );
};
