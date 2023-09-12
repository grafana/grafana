import React from 'react';

import { Drawer } from '@grafana/ui';

import { RuleInspectorTabs } from '../rule-editor/RuleInspector';

import { ExportFormats, ExportFormatsWithoutHCL, grafanaExportProviders, grafanaExportProvidersWithoutHCL } from './providers';

interface GrafanaExportDrawerProps {
  activeTab: ExportFormats | ExportFormatsWithoutHCL;
  onTabChange: (tab: ExportFormats | ExportFormatsWithoutHCL) => void;
  children: React.ReactNode;
  onClose: () => void;
  allowHcl?: boolean;
}

export function GrafanaExportDrawer({ activeTab, onTabChange, children, onClose, allowHcl = false }: GrafanaExportDrawerProps) {

  const grafanaRulesTabs = allowHcl ? Object.values(grafanaExportProviders).map((provider) => ({
    label: provider.name,
    value: provider.exportFormat,
  })) : Object.values(grafanaExportProvidersWithoutHCL).map((provider) => ({
    label: provider.name,
    value: provider.exportFormat,
  }))

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
