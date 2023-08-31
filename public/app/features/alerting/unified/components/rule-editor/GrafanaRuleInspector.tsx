import React, { useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { CodeEditor, Drawer, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';
import { grafanaRuleExportProviders, RuleExportFormats } from '../export/providers';

import { RuleInspectorTabs, yamlTabStyle } from './RuleInspector';

interface Props {
  onClose: () => void;
  alertUid: string;
}

const grafanaRulesTabs = Object.values(grafanaRuleExportProviders).map((provider) => ({
  label: provider.name,
  value: provider.exportFormat,
}));

export const GrafanaRuleInspector = ({ onClose, alertUid }: Props) => {
  const [activeTab, setActiveTab] = useState<RuleExportFormats>('yaml');

  return (
    <Drawer
      title="Inspect Alert rule"
      tabs={
        <RuleInspectorTabs<RuleExportFormats>
          tabs={grafanaRulesTabs}
          setActiveTab={setActiveTab}
          activeTab={activeTab}
        />
      }
      onClose={onClose}
    >
      <GrafanaInspectorRuleDefinition alertUid={alertUid} exportFormat={activeTab} />
    </Drawer>
  );
};

const { useExportRuleQuery } = alertRuleApi;

interface YamlTabProps {
  alertUid: string;
  exportFormat: RuleExportFormats;
}

const GrafanaInspectorRuleDefinition = ({ alertUid, exportFormat }: YamlTabProps) => {
  const styles = useStyles2(yamlTabStyle);

  const { currentData: ruleTextDefinition = '', isFetching } = useExportRuleQuery({
    uid: alertUid,
    format: exportFormat,
  });

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  const provider = grafanaRuleExportProviders[exportFormat];
  const formattedTextDefinition = provider.formatter ? provider.formatter(ruleTextDefinition) : ruleTextDefinition;

  return (
    // TODO Handle empty content
    <div className={styles.content}>
      <AutoSizer disableWidth>
        {({ height }) => (
          <CodeEditor
            width="100%"
            height={height}
            language={exportFormat}
            value={formattedTextDefinition}
            monacoOptions={{
              minimap: {
                enabled: false,
              },
              lineNumbers: 'on',
              readOnly: true,
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
};
