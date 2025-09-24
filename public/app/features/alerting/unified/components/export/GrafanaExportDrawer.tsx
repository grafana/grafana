import * as React from 'react';

import { t } from '@grafana/i18n';
import { Drawer } from '@grafana/ui';

import { RuleInspectorTabs } from '../rule-editor/RuleInspector';

import { ExportFormats, ExportProvider } from './providers';

interface GrafanaExportDrawerProps {
  activeTab: ExportFormats;
  onTabChange: (tab: ExportFormats) => void;
  children: React.ReactNode;
  onClose: () => void;
  formatProviders: Array<ExportProvider<ExportFormats>>;
  title?: string;
}

export function GrafanaExportDrawer({
  activeTab,
  onTabChange,
  children,
  onClose,
  formatProviders,
  title = 'Export',
}: GrafanaExportDrawerProps) {
  const grafanaRulesTabs = Object.values(formatProviders).map((provider) => ({
    label: provider.name,
    value: provider.exportFormat,
  }));
  const subtitle =
    formatProviders.length > 1
      ? t(
          'alerting.export.subtitle.formats',
          'Select the format and download the file or copy the contents to clipboard'
        )
      : t('alerting.export.subtitle.one-format', 'Download the file or copy the contents to clipboard');
  return (
    <Drawer
      title={title}
      subtitle={subtitle}
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
