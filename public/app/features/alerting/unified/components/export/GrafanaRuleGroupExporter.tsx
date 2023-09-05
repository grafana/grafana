import React, { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { RuleExportFormats } from './providers';

interface GrafanaRuleGroupExporterProps {
  folderUid: string;
  groupName: string;
  onClose: () => void;
}

export function GrafanaRuleGroupExporter({ folderUid, groupName, onClose }: GrafanaRuleGroupExporterProps) {
  const [activeTab, setActiveTab] = useState<RuleExportFormats>('yaml');

  return (
    <GrafanaExportDrawer activeTab={activeTab} onTabChange={setActiveTab} onClose={onClose}>
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
  exportFormat: RuleExportFormats;
  onClose: () => void;
}

function GrafanaRuleGroupExportPreview({
  folderUid,
  groupName,
  exportFormat,
  onClose,
}: GrafanaRuleGroupExportPreviewProps) {
  const { currentData: ruleGroupTextDefinition = '', isFetching } = alertRuleApi.useExportRuleGroupQuery({
    folderUid,
    groupName,
    format: exportFormat,
  });

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
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
