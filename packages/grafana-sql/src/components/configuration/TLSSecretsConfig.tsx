import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  KeyValue,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
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
                <span>TLS/SSL Client Certificate</span>
                <Tooltip
                  content={
                    <span>
                      To authenticate with an TLS/SSL client certificate, provide the client certificate here.
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
                <span>TLS/SSL Root Certificate</span>
                <Tooltip
                  content={
                    <span>If the selected TLS/SSL mode requires a server root certificate, provide it here.</span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <SecretTextArea
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
                <span>TLS/SSL Client Key</span>
                <Tooltip
                  content={<span>To authenticate with a client TLS/SSL certificate, provide the key here.</span>}
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <SecretTextArea
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
