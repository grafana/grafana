import React, { useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { CodeEditor, Drawer, useStyles2 } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';

import { drawerStyles, RuleInspectorSubtitle, yamlTabStyle } from './RuleInspector';

interface Props {
  onClose: () => void;
  alertUid: string;
}

export const GrafanaRuleInspector = ({ onClose, alertUid }: Props) => {
  const [activeTab, setActiveTab] = useState('yaml');

  const styles = useStyles2(drawerStyles);

  return (
    <Drawer
      title="Inspect Alert rule"
      subtitle={
        <div className={styles.subtitle}>
          <RuleInspectorSubtitle setActiveTab={setActiveTab} activeTab={activeTab} />
        </div>
      }
      onClose={onClose}
    >
      {activeTab === 'yaml' && <GrafanaInspectorYamlTab alertUid={alertUid} />}
    </Drawer>
  );
};

const { useExportRuleQuery } = alertRuleApi;

interface YamlTabProps {
  alertUid: string;
}

const GrafanaInspectorYamlTab = ({ alertUid }: YamlTabProps) => {
  const styles = useStyles2(yamlTabStyle);

  const { currentData: ruleYamlConfig, isLoading } = useExportRuleQuery({ uid: alertUid, format: 'yaml' });

  const yamlRule = useMemo(() => ruleYamlConfig, [ruleYamlConfig]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className={styles.content}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <CodeEditor
              width="100%"
              height={height}
              language="yaml"
              value={yamlRule || ''}
              monacoOptions={{
                minimap: {
                  enabled: false,
                },
              }}
            />
          )}
        </AutoSizer>
      </div>
    </>
  );
};
