import React from 'react';

import { Drawer } from '@grafana/ui';

import { RuleInspectorTabs } from '../rule-editor/RuleInspector';

import { ExportFormats, grafanaExportProviders } from './providers';

const grafanaRulesTabs = Object.values(grafanaExportProviders).map((provider) => ({
  label: provider.name,
  value: provider.exportFormat,
}));

interface GrafanaExportDrawerProps {
  activeTab: ExportFormats;
  onTabChange: (tab: ExportFormats) => void;
  children: React.ReactNode;
  onClose: () => void;
}

export function GrafanaExportDrawer({ activeTab, onTabChange, children, onClose }: GrafanaExportDrawerProps) {
  return (
    <Drawer
      title="Export"
      subtitle="Select the format and download the file or copy the contents to clipboard"
      tabs={
        <RuleInspectorTabs<ExportFormats> tabs={grafanaRulesTabs} setActiveTab={onTabChange} activeTab={activeTab} />
      }
      onClose={onClose}
      size="md"
    >
      {children}
    </Drawer>
  );
}
