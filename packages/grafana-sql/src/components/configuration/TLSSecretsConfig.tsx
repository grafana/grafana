import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  KeyValue,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Field, Icon, Label, SecretTextArea, Tooltip, Stack } from '@grafana/ui';

export interface Props<T extends DataSourceJsonData, S> {
  editorProps: DataSourcePluginOptionsEditorProps<T, S>;
  showCACert?: boolean;
  showKeyPair?: boolean;
  secureJsonFields?: KeyValue<Boolean>;
  labelWidth?: number;
}

export const TLSSecretsConfig = <T extends DataSourceJsonData, S extends {} = {}>(props: Props<T, S>) => {
  const { editorProps, showCACert, showKeyPair = true } = props;
  const { secureJsonFields } = editorProps.options;
  return (
    <>
      {showKeyPair ? (
        <Field
          label={
            <Label>
              <Stack gap={0.5}>
                <span>
                  <Trans i18nKey="grafana-sql.components.tlssecrets-config.tlsssl-client-certificate">
                    TLS/SSL Client Certificate
                  </Trans>
                </span>
                <Tooltip
                  content={
                    <span>
                      <Trans i18nKey="grafana-sql.components.tlssecrets-config.content-tlsssl-client-certificate">
                        To authenticate with an TLS/SSL client certificate, provide the client certificate here.
                      </Trans>
                    </span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <SecretTextArea
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="-----BEGIN CERTIFICATE-----"
            cols={45}
            rows={7}
            isConfigured={secureJsonFields && secureJsonFields.tlsClientCert}
            onChange={onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsClientCert')}
            onReset={() => {
              updateDatasourcePluginResetOption(editorProps, 'tlsClientCert');
            }}
          />
        </Field>
      ) : null}
      {showCACert ? (
        <Field
          label={
            <Label>
              <Stack gap={0.5}>
                <span>
                  <Trans i18nKey="grafana-sql.components.tlssecrets-config.tlsssl-root-certificate">
                    TLS/SSL Root Certificate
                  </Trans>
                </span>
                <Tooltip
                  content={
                    <span>
                      <Trans i18nKey="grafana-sql.components.tlssecrets-config.content-tlsssl-root-certificate">
                        If the selected TLS/SSL mode requires a server root certificate, provide it here
                      </Trans>
                    </span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <SecretTextArea
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="-----BEGIN CERTIFICATE-----"
            cols={45}
            rows={7}
            isConfigured={secureJsonFields && secureJsonFields.tlsCACert}
            onChange={onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsCACert')}
            onReset={() => {
              updateDatasourcePluginResetOption(editorProps, 'tlsCACert');
            }}
          />
        </Field>
      ) : null}
      {showKeyPair ? (
        <Field
          label={
            <Label>
              <Stack gap={0.5}>
                <span>
                  <Trans i18nKey="grafana-sql.components.tlssecrets-config.tlsssl-client-key">TLS/SSL Client Key</Trans>
                </span>
                <Tooltip
                  content={
                    <span>
                      <Trans i18nKey="grafana-sql.components.tlssecrets-config.content-tlsssl-client-key">
                        To authenticate with a client TLS/SSL certificate, provide the key here.
                      </Trans>
                    </span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <SecretTextArea
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="-----BEGIN RSA PRIVATE KEY-----"
            cols={45}
            rows={7}
            isConfigured={secureJsonFields && secureJsonFields.tlsClientKey}
            onChange={onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsClientKey')}
            onReset={() => {
              updateDatasourcePluginResetOption(editorProps, 'tlsClientKey');
            }}
          />
        </Field>
      ) : null}
    </>
  );
};
