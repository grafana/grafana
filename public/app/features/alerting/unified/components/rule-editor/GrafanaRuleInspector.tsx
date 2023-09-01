import { css } from '@emotion/css';
import saveAs from 'file-saver';
import React, { useCallback, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ClipboardButton, CodeEditor, Drawer, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';
import { grafanaRuleExportProviders, RuleExportFormats } from '../export/providers';

import { RuleInspectorTabs } from './RuleInspector';

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

const { useExportRuleQuery } = alertRuleApi;

interface YamlTabProps {
  alertUid: string;
  exportFormat: RuleExportFormats;
  onClose: () => void;
}

const GrafanaInspectorRuleDefinition = ({ alertUid, exportFormat, onClose }: YamlTabProps) => {
  const styles = useStyles2(grafanaInspectorStyles);

  const { currentData: ruleTextDefinition = '', isFetching } = useExportRuleQuery({
    uid: alertUid,
    format: exportFormat,
  });

  const onDownload = useCallback(() => {
    const blob = new Blob([ruleTextDefinition], {
      type: `application/${exportFormat};charset=utf-8`,
    });
    saveAs(blob, `${alertUid}-${new Date().getTime()}.${exportFormat}`);

    onClose();
  }, [alertUid, exportFormat, ruleTextDefinition, onClose]);

  if (isFetching) {
    return <LoadingPlaceholder text="Loading...." />;
  }

  const provider = grafanaRuleExportProviders[exportFormat];
  const formattedTextDefinition = provider.formatter ? provider.formatter(ruleTextDefinition) : ruleTextDefinition;

  return (
    // TODO Handle empty content
    <div className={styles.container}>
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
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <ClipboardButton icon="copy" getText={() => formattedTextDefinition}>
          Copy code
        </ClipboardButton>
        <Button icon="download-alt" onClick={onDownload}>
          Download
        </Button>
      </div>
    </div>
  );
};

const grafanaInspectorStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: ${theme.spacing(2)};
  `,
  content: css`
    flex: 1 1 100%;
  `,
  actions: css`
    flex: 0;
    justify-content: flex-end;
    display: flex;
    gap: ${theme.spacing(1)};
  `,
});
