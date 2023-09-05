import React, { useState } from 'react';

import { Drawer, LoadingPlaceholder } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';
import { RuleInspectorTabs } from '../rule-editor/RuleInspector';

import { FileExportPreview } from './FileExportPreview';
import { grafanaRuleExportProviders, RuleExportFormats } from './providers';

interface Props {
  onClose: () => void;
  alertUid: string;
}

const grafanaRulesTabs = Object.values(grafanaRuleExportProviders).map((provider) => ({
  label: provider.name,
  value: provider.exportFormat,
}));
export const GrafanaRuleExporter = ({ onClose, alertUid }: Props) => {
  const [activeTab, setActiveTab] = useState<RuleExportFormats>('yaml');

  return (
    <Drawer
      title="Export"
      subtitle="Select the format and download the file or copy the contents to clipboard"
      tabs={
        <RuleInspectorTabs<RuleExportFormats>
          tabs={grafanaRulesTabs}
          setActiveTab={setActiveTab}
          activeTab={activeTab}
        />
      }
      onClose={onClose}
      size="md"
    >
      <GrafanaInspectorRuleDefinition alertUid={alertUid} exportFormat={activeTab} onClose={onClose} />
    </Drawer>
  );
};

interface YamlTabProps {
  alertUid: string;
  exportFormat: RuleExportFormats;
  onClose: () => void;
}

const GrafanaInspectorRuleDefinition = ({ alertUid, exportFormat, onClose }: YamlTabProps) => {
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
