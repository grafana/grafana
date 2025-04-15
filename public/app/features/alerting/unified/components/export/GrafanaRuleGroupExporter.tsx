import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';

interface GrafanaRuleGroupExporterProps {
  folderUid: string;
  groupName: string;
  onClose: () => void;
}

export function GrafanaRuleGroupExporter({ folderUid, groupName, onClose }: GrafanaRuleGroupExporterProps) {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');

  return (
    <GrafanaExportDrawer
      title={t('alerting.grafana-rule-group-exporter.title-drawer', 'Export {{groupName}} rules', { groupName })}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      <GrafanaRuleGroupExportPreview
        folderUid={folderUid}
        groupName={groupName}
        exportFormat={activeTab}
        onClose={onClose}
      />
    </GrafanaExportDrawer>
  );
}

interface GrafanaRuleGroupExportPreviewProps {
  folderUid: string;
  groupName: string;
  exportFormat: ExportFormats;
  onClose: () => void;
}

function GrafanaRuleGroupExportPreview({
  folderUid,
  groupName,
  exportFormat,
  onClose,
}: GrafanaRuleGroupExportPreviewProps) {
  const { currentData: ruleGroupTextDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
    folderUid,
    group: groupName,
    format: exportFormat,
  });

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-rule-group-export-preview.text-loading', 'Loading....')} />;
  }

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={ruleGroupTextDefinition}
      downloadFileName={groupName}
      onClose={onClose}
    />
  );
}
