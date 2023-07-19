import { dump } from 'js-yaml';
import React, { useEffect, useState } from 'react';
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

const { useLazyExportRuleQuery } = alertRuleApi;

interface YamlTabProps {
  alertUid: string;
}

const GrafanaInspectorYamlTab = ({ alertUid }: YamlTabProps) => {
  const styles = useStyles2(yamlTabStyle);

  const [exportRule] = useLazyExportRuleQuery();

  const [alertRuleAsYaml, setAlertRuleAsYaml] = useState('');

  useEffect(() => {
    exportRule({ uid: alertUid, format: 'yaml' })
      .unwrap()
      .then((result) => {
        setAlertRuleAsYaml(dump(result));
      });
  }, [exportRule, alertUid]);

  return (
    <>
      <div className={styles.content}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <CodeEditor
              width="100%"
              height={height}
              language="yaml"
              value={alertRuleAsYaml}
              onBlur={setAlertRuleAsYaml}
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
