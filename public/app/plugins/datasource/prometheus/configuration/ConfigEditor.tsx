import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  Alert,
  DataSourceHttpSettings,
  FieldValidationMessage,
  InlineField,
  Input,
  SecureSocksProxySettings,
  useTheme2,
} from '@grafana/ui';
import { config } from 'app/core/config';

import { PromOptions } from '../types';

import { AlertingSettingsOverhaul } from './AlertingSettingsOverhaul';
import { AzureAuthSettings } from './AzureAuthSettings';
import { hasCredentials, setDefaultCredentials, resetCredentials } from './AzureCredentialsConfig';
import { PromSettings } from './PromSettings';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  const [validPromUrl, updateValidPromUrl] = useState<string>('');
  // use ref so this is evaluated only first time it renders and the select does not disappear suddenly.
  const showAccessOptions = useRef(props.options.access === 'direct');

  const azureAuthSettings = {
    azureAuthSupported: config.azureAuthEnabled,
    getAzureAuthEnabled: (config: DataSourceSettings<any, any>): boolean => hasCredentials(config),
    setAzureAuthEnabled: (config: DataSourceSettings<any, any>, enabled: boolean) =>
      enabled ? setDefaultCredentials(config) : resetCredentials(config),
    azureSettingsUI: AzureAuthSettings,
  };

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  const onSettingsChange = useCallback(
    // eslint-disable-next-line
    (change: Partial<DataSourceSettings<any, any>>) => {
      onOptionsChange({
        ...options,
        ...change,
      });
    },
    [options, onOptionsChange]
  );

  let urlTooltip;

  switch (options.access) {
    case 'direct':
      urlTooltip = (
        <>
          Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          {docsTip()}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = <>This URL must be accessible from the Grafana server. {docsTip()}</>;
      break;
    default:
      urlTooltip = 'Specify a complete HTTP URL (for example http://your_server:8080)';
  }

  const validUrlRegex = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;

  const defaultUrl = 'http://localhost:9090';

  const urlInput = (
    <>
      <Input
        className="width-20"
        placeholder={defaultUrl}
        value={options.url}
        // eslint-disable-next-line
        aria-label={selectors.components.DataSource.DataSourceHttpSettings.urlInput}
        onChange={(event) => onSettingsChange({ url: event.currentTarget.value })}
        disabled={options.readOnly}
        onBlur={(e) => updateValidPromUrl(e.currentTarget.value)}
      />
      {validateDurationInput(validPromUrl, validUrlRegex)}
    </>
  );

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Prometheus data source is no longer available. Switch to server access mode.
        </Alert>
      )}

      <>
        <hr />
        <h3 className={styles.sectionHeaderPadding}>Connection</h3>
        <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
          Provide information to connect to this data source.
        </p>
        <div className="gf-form-group">
          <div className="gf-form">
            <InlineField interactive={true} label="Prometheus Server URL" labelWidth={26} tooltip={urlTooltip}>
              {urlInput}
            </InlineField>
          </div>
        </div>
        <div className={`${styles.sectionBottomPadding} ${styles.secondaryGrey}`}>
          For more information on configuring the Grafana Prometheus data source see the{' '}
          <a
            style={{ textDecoration: 'underline' }}
            href="https://grafana.com/docs/grafana/latest/datasources/prometheus/#configure-the-data-source"
            target="_blank"
            rel="noopener noreferrer"
          >
            documentation
          </a>
          .
        </div>
      </>
      <hr className={styles.hrBottomSpace} />
      <DataSourceHttpSettings
        dataSourceConfig={options}
        showAccessOptions={showAccessOptions.current}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        azureAuthSettings={azureAuthSettings}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
      />

      {config.featureToggles.secureSocksDatasourceProxy && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}
      <>
        <hr className={styles.hrTopSpace} />
        <h3 className={styles.sectionHeaderPadding}>Additional Settings</h3>
        <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
          Additional settings are optional settings that can be configured for more control over your data source.
        </p>

        <AlertingSettingsOverhaul<PromOptions> options={options} onOptionsChange={onOptionsChange} />

        <PromSettings options={options} onOptionsChange={onOptionsChange} />
      </>
    </>
  );
};

export function docsTip(url?: string) {
  const docsUrl = 'https://grafana.com/docs/grafana/latest/datasources/prometheus/#configure-the-data-source';

  return (
    <a href={url ? url : docsUrl} target="_blank" rel="noopener noreferrer">
      Visit docs for more details here.
    </a>
  );
}

export const validateDurationInput = (
  input: string,
  pattern: string | RegExp,
  errorMessage?: string
): boolean | JSX.Element => {
  const defaultErrorMessage = 'Value is not valid';
  if (input && !input.match(pattern)) {
    return <FieldValidationMessage>{errorMessage ? errorMessage : defaultErrorMessage}</FieldValidationMessage>;
  } else {
    return true;
  }
};

export function overhaulStyles(theme: GrafanaTheme2) {
  return {
    additionalSettings: css`
      margin-bottom: 25px;
    `,
    secondaryGrey: css`
      color: ${theme.colors.secondary.text};
      opacity: 65%;
    `,
    inlineError: css`
      margin: 0px 0px 4px 245px;
    `,
    switchField: css`
      align-items: center;
    `,
    sectionHeaderPadding: css`
      padding-top: 32px;
    `,
    sectionBottomPadding: css`
      padding-bottom: 32px;
    `,
    subsectionText: css`
      font-size: 12px;
    `,
    hrBottomSpace: css`
      margin-bottom: 60px;
    `,
    hrTopSpace: css`
      margin-top: 50px;
    `,
  };
}
