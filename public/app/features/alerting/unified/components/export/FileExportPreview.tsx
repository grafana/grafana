import { css } from '@emotion/css';
import saveAs from 'file-saver';
import { useCallback, useMemo } from 'react';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, ClipboardButton, CodeEditor, TextLink, useStyles2 } from '@grafana/ui';

import { ExportFormats, ExportProvider, ProvisioningType, allGrafanaExportProviders } from './providers';

interface FileExportPreviewProps {
  format: ExportFormats;
  textDefinition: string;

  /*** Filename without extension ***/
  downloadFileName: string;
  onClose: () => void;
}

export function FileExportPreview({ format, textDefinition, downloadFileName, onClose }: FileExportPreviewProps) {
  const styles = useStyles2(fileExportPreviewStyles);
  const provider = allGrafanaExportProviders[format];

  const onDownload = useCallback(() => {
    const blob = new Blob([textDefinition], {
      type: `application/${format};charset=utf-8`,
    });
    saveAs(blob, `${downloadFileName}.${format}`);
  }, [textDefinition, downloadFileName, format]);

  const formattedTextDefinition = useMemo(() => {
    return provider.formatter ? provider.formatter(textDefinition) : textDefinition;
  }, [provider, textDefinition]);

  return (
    // TODO Handle empty content
    <div className={styles.container}>
      <FileExportInlineDocumentation exportProvider={provider} />
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
                scrollBeyondLastLine: false,
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
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: theme.spacing(2),
  }),
  content: css({
    flex: '1 1 100%',
  }),
  actions: css({
    flex: 0,
    justifyContent: 'flex-end',
    display: 'flex',
    gap: theme.spacing(1),
  }),
});

function FileExportInlineDocumentation({ exportProvider }: { exportProvider: ExportProvider<unknown> }) {
  const { name, type } = exportProvider;

  const exportInlineDoc: Record<ProvisioningType, { title: string; component: React.ReactNode }> = {
    file: {
      title: 'File-provisioning format',
      component: (
        <>
          {name} format is only valid for File Provisioning.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/file-provisioning/"
            external
          >
            Read more in the docs.
          </TextLink>
        </>
      ),
    },
    api: {
      title: 'API-provisioning format',
      component: (
        <>
          {name} format is only valid for API Provisioning.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/http-api-provisioning/"
            external
          >
            Read more in the docs.
          </TextLink>
        </>
      ),
    },
    terraform: {
      title: 'Terraform-provisioning format',
      component: (
        <>
          {name} format is only valid for Terraform Provisioning.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/terraform-provisioning/"
            external
          >
            Read more in the docs.
          </TextLink>
        </>
      ),
    },
  };

  const { title, component } = exportInlineDoc[type];

  return (
    <Alert title={title} severity="info" bottomSpacing={0} topSpacing={0}>
      {component}
    </Alert>
  );
}
