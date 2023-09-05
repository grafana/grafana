import { css } from '@emotion/css';
import saveAs from 'file-saver';
import React, { useCallback, useMemo, useState } from 'react';
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

interface FileExportPreviewProps {
  format: RuleExportFormats;
  textDefinition: string;

  /*** Filename without extension ***/
  downloadFileName: string;
  onClose: () => void;
}

export function FileExportPreview({ format, textDefinition, downloadFileName, onClose }: FileExportPreviewProps) {
  const styles = useStyles2(fileExportPreviewStyles);

  const onDownload = useCallback(() => {
    const blob = new Blob([textDefinition], {
      type: `application/${format};charset=utf-8`,
    });
    saveAs(blob, `${downloadFileName}.${format}`);

    onClose();
  }, [textDefinition, downloadFileName, format, onClose]);

  const formattedTextDefinition = useMemo(() => {
    const provider = grafanaRuleExportProviders[format];
    return provider.formatter ? provider.formatter(textDefinition) : textDefinition;
  }, [format, textDefinition]);

  return (
    // TODO Handle empty content
    <div className={styles.container}>
      <div className={styles.content}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <CodeEditor
              width="100%"
              height={height}
              language={format}
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
        <ClipboardButton icon="copy" getText={() => textDefinition}>
          Copy code
        </ClipboardButton>
        <Button icon="download-alt" onClick={onDownload}>
          Download
        </Button>
      </div>
    </div>
  );
}

const fileExportPreviewStyles = (theme: GrafanaTheme2) => ({
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
