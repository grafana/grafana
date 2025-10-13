import { css } from '@emotion/css';
import saveAs from 'file-saver';
import { useCallback, useMemo } from 'react';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, ClipboardButton, CodeEditor, Stack, Switch, TextLink, useStyles2 } from '@grafana/ui';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { Spacer } from '../Spacer';

import { ExportFormats, ExportProvider, ProvisioningType, allGrafanaExportProviders } from './providers';

type DecryptProps =
  | {
      supportsDecryption: true;
      decrypt: boolean;
      onToggleDecrypt: () => void;
    }
  | {
      supportsDecryption?: false;
      decrypt?: never;
      onToggleDecrypt?: never;
    };

type FileExportPreviewProps = {
  format: ExportFormats;
  textDefinition: string;

  /*** Filename without extension ***/
  downloadFileName: string;
  onClose: () => void;
} & DecryptProps;

export function FileExportPreview({
  format,
  textDefinition,
  downloadFileName,
  supportsDecryption = false,
  decrypt,
  onToggleDecrypt,
  onClose,
}: FileExportPreviewProps) {
  const styles = useStyles2(fileExportPreviewStyles);
  const [decryptSecretsSupported, decryptSecretsAllowed] = useAlertmanagerAbility(AlertmanagerAction.DecryptSecrets);
  const canReadSecrets = decryptSecretsSupported && decryptSecretsAllowed;

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
        {canReadSecrets && supportsDecryption && (
          <Stack direction="row" alignItems="center">
            <Switch id="toggleDecryption" onClick={onToggleDecrypt} value={decrypt} />
            <label htmlFor="toggleDecryption">
              {t('alerting.file-export-preview.label-decrypt-values', 'Show secret values')}
            </label>
          </Stack>
        )}
        <Spacer />
        <Button variant="secondary" onClick={onClose}>
          <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
        </Button>
        <ClipboardButton icon="copy" getText={() => textDefinition}>
          <Trans i18nKey="alerting.file-export-preview.copy-code">Copy code</Trans>
        </ClipboardButton>
        <Button icon="download-alt" onClick={onDownload}>
          <Trans i18nKey="alerting.file-export-preview.download">Download</Trans>
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
      title: t(
        'alerting.file-export-inline-documentation.export-inline-doc.title.fileprovisioning-format',
        'File-provisioning format'
      ),
      component: (
        <Trans i18nKey="alerting.file-export-inline-documentation.file-provisioning">
          {{ name }} format is only valid for File Provisioning.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/file-provisioning/"
            external
          >
            Read more in the docs.
          </TextLink>
        </Trans>
      ),
    },
    api: {
      title: t(
        'alerting.file-export-inline-documentation.export-inline-doc.title.apiprovisioning-format',
        'API-provisioning format'
      ),
      component: (
        <Trans i18nKey="alerting.file-export-inline-documentation.api-provisioning">
          {{ name }} format is only valid for API Provisioning.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/http-api-provisioning/"
            external
          >
            Read more in the docs.
          </TextLink>
        </Trans>
      ),
    },
    terraform: {
      title: t(
        'alerting.file-export-inline-documentation.export-inline-doc.title.terraformprovisioning-format',
        'Terraform-provisioning format'
      ),
      component: (
        <Trans i18nKey="alerting.file-export-inline-documentation.terraform-provisioning">
          {{ name }} format is only valid for Terraform Provisioning.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/terraform-provisioning/"
            external
          >
            Read more in the docs.
          </TextLink>
        </Trans>
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
