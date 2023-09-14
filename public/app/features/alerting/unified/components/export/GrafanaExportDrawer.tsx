import React from 'react';

import { Drawer } from '@grafana/ui';

import { RuleInspectorTabs } from '../rule-editor/RuleInspector';

import { grafanaRuleExportProviders, RuleExportFormats } from './providers';

const grafanaRulesTabs = Object.values(grafanaRuleExportProviders).map((provider) => ({
  label: provider.name,
  value: provider.exportFormat,
}));

interface GrafanaExportDrawerProps {
  activeTab: RuleExportFormats;
  onTabChange: (tab: RuleExportFormats) => void;
  children: React.ReactNode;
  onClose: () => void;
}

export function GrafanaExportDrawer({ activeTab, onTabChange, children, onClose }: GrafanaExportDrawerProps) {
  return (
    <Drawer
      title="Export"
      subtitle="Select the format and download the file or copy the contents to clipboard"
      tabs={
        <RuleInspectorTabs<RuleExportFormats>
          tabs={grafanaRulesTabs}
          setActiveTab={onTabChange}
          activeTab={activeTab}
        />
      }
      onClose={onClose}
      size="md"
    >
      {children}
    </Drawer>
  );
}
