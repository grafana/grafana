import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  KeyValue,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineField, SecretTextArea } from '@grafana/ui';

export interface Props<T extends DataSourceJsonData, S> {
  editorProps: DataSourcePluginOptionsEditorProps<T, S>;
  showCACert?: boolean;
  secureJsonFields?: KeyValue<Boolean>;
  labelWidth?: number;
}

export const TLSSecretsConfig = <T extends DataSourceJsonData, S extends {} = {}>(props: Props<T, S>) => {
  const { labelWidth, editorProps, showCACert } = props;
  const { secureJsonFields } = editorProps.options;
  return (
    <>
      <InlineField
        tooltip={<span>To authenticate with an TLS/SSL client certificate, provide the client certificate here.</span>}
        labelWidth={labelWidth}
        label="TLS/SSL Client Certificate"
      >
        <SecretTextArea
          placeholder="Begins with -----BEGIN CERTIFICATE-----"
          cols={45}
          rows={7}
          isConfigured={secureJsonFields && secureJsonFields.tlsClientCert}
          onChange={onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsClientCert')}
          onReset={() => {
            updateDatasourcePluginResetOption(editorProps, 'tlsClientCert');
          }}
        ></SecretTextArea>
      </InlineField>
      {showCACert ? (
        <InlineField
          tooltip={<span>If the selected TLS/SSL mode requires a server root certificate, provide it here.</span>}
          labelWidth={labelWidth}
          label="TLS/SSL Root Certificate"
        >
          <SecretTextArea
            placeholder="Begins with -----BEGIN CERTIFICATE-----"
            cols={45}
            rows={7}
            isConfigured={secureJsonFields && secureJsonFields.tlsCACert}
            onChange={onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsCACert')}
            onReset={() => {
              updateDatasourcePluginResetOption(editorProps, 'tlsCACert');
            }}
          ></SecretTextArea>
        </InlineField>
      ) : null}

      <InlineField
        tooltip={<span>To authenticate with a client TLS/SSL certificate, provide the key here.</span>}
        labelWidth={labelWidth}
        label="TLS/SSL Client Key"
      >
        <SecretTextArea
          placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
          cols={45}
          rows={7}
          isConfigured={secureJsonFields && secureJsonFields.tlsClientKey}
          onChange={onUpdateDatasourceSecureJsonDataOption(editorProps, 'tlsClientKey')}
          onReset={() => {
            updateDatasourcePluginResetOption(editorProps, 'tlsClientKey');
          }}
        ></SecretTextArea>
      </InlineField>
    </>
  );
};
