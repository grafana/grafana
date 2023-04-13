import { css, cx } from '@emotion/css';
import React, { useState, useCallback } from 'react';

import { DataSourceSettings, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  useTheme2,
  InlineField,
  Input,
  Icon,
  Select,
  InlineSwitch,
  TagsInput,
  CustomHeadersSettings,
  TLSAuthSettings,
} from '@grafana/ui';
import { BasicAuthSettings } from '@grafana/ui/src/components/DataSourceSettings/BasicAuthSettings';
import { HttpProxySettings } from '@grafana/ui/src/components/DataSourceSettings/HttpProxySettings';
import { HttpSettingsProps } from '@grafana/ui/src/components/DataSourceSettings/types';

const ACCESS_OPTIONS: Array<SelectableValue<string>> = [
  {
    label: 'Server (default)',
    value: 'proxy',
  },
  {
    label: 'Browser',
    value: 'direct',
  },
];

const DEFAULT_ACCESS_OPTION = {
  label: 'Server (default)',
  value: 'proxy',
};

const HttpAccessHelp = () => (
  <div className="grafana-info-box m-t-2">
    <p>
      Access mode controls how requests to the data source will be handled.
      <strong>
        &nbsp;<i>Server</i>
      </strong>{' '}
      should be the preferred way if nothing else is stated.
    </p>
    <div className="alert-title">Server access mode (Default):</div>
    <p>
      All requests will be made from the browser to Grafana backend/server which in turn will forward the requests to
      the data source and by that circumvent possible Cross-Origin Resource Sharing (CORS) requirements. The URL needs
      to be accessible from the grafana backend/server if you select this access mode.
    </p>
    <div className="alert-title">Browser access mode:</div>
    <p>
      All requests will be made from the browser directly to the data source and may be subject to Cross-Origin Resource
      Sharing (CORS) requirements. The URL needs to be accessible from the browser if you select this access mode.
    </p>
  </div>
);

const LABEL_WIDTH = 26;

export function docsTip(url?: string) {
  const docsUrl = 'https://grafana.com/docs/grafana/latest/datasources/prometheus/#configure-the-data-source';

  return (
    <a href={url ? url : docsUrl} target="_blank" rel="noopener noreferrer">
      Visit docs for more details here.
    </a>
  );
}

export const DataSourceHttpSettingsOverhaul = (props: HttpSettingsProps) => {
  const {
    defaultUrl,
    dataSourceConfig,
    onChange,
    showAccessOptions,
    sigV4AuthToggleEnabled,
    showForwardOAuthIdentityOption,
    azureAuthSettings,
    renderSigV4Editor,
  } = props;
  let urlTooltip;
  const [isAccessHelpVisible, setIsAccessHelpVisible] = useState(false);
  const theme = useTheme2();
  const styles = overhaulStyles(theme);
  const onSettingsChange = useCallback(
    // eslint-disable-next-line
    (change: Partial<DataSourceSettings<any, any>>) => {
      onChange({
        ...dataSourceConfig,
        ...change,
      });
    },
    [dataSourceConfig, onChange]
  );

  switch (dataSourceConfig.access) {
    case 'direct':
      urlTooltip = (
        <>
          Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          {docsTip()}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = <>This URL must be accessible from the Grafana server.</>;
      break;
    default:
      urlTooltip = 'Specify a complete HTTP URL (for example http://your_server:8080)';
  }

  const accessSelect = (
    <Select
      data-testid="Access"
      width={40}
      className="gf-form-input"
      options={ACCESS_OPTIONS}
      value={
        ACCESS_OPTIONS.filter((o: SelectableValue) => o.value === dataSourceConfig.access)[0] || DEFAULT_ACCESS_OPTION
      }
      onChange={(selectedValue) => onSettingsChange({ access: selectedValue.value })}
      disabled={dataSourceConfig.readOnly}
    />
  );

  const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
    dataSourceConfig.url
  );

  const notValidStyle = css`
    box-shadow: inset 0 0px 5px ${theme.v1.palette.red};
  `;

  const inputStyle = cx({ [`width-20`]: true, [notValidStyle]: !isValidUrl });

  const urlInput = (
    <Input
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.url}
      // eslint-disable-next-line
      aria-label={selectors.components.DataSource.DataSourceHttpSettings.urlInput}
      onChange={(event) => onSettingsChange({ url: event.currentTarget.value })}
      disabled={dataSourceConfig.readOnly}
    />
  );

  const azureAuthEnabled: boolean =
    (azureAuthSettings?.azureAuthSupported && azureAuthSettings.getAzureAuthEnabled(dataSourceConfig)) || false;

  return (
    <div className={styles.sectionBottomPadding}>
      <>
        <hr />
        <h3 className={styles.sectionHeaderPadding}>Connection</h3>
        <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
          Provide information to connect to this data source.
        </p>
        <div className="gf-form-group">
          <div className="gf-form">
            <InlineField label="Prometheus Server URL" labelWidth={26} tooltip={urlTooltip}>
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

      <>
        <hr />
        <h3 className={styles.sectionHeaderPadding}>Authentication</h3>
        <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
          Provide information to grant access to this data source.
        </p>
        <div className={styles.sectionBottomPadding}>
          <div className="gf-form-inline">
            <InlineField
              label="Basic auth"
              labelWidth={LABEL_WIDTH}
              disabled={dataSourceConfig.readOnly}
              tooltip={<>Enable basic authentication to the Prometheus data source. {docsTip()}</>}
            >
              <InlineSwitch
                id="http-settings-basic-auth"
                value={dataSourceConfig.basicAuth}
                onChange={(event) => {
                  onSettingsChange({ basicAuth: event!.currentTarget.checked });
                }}
              />
            </InlineField>

            <InlineField
              label="With Credentials"
              tooltip={
                <>
                  Whether credentials such as cookies or auth headers should be sent with cross-site requests.{' '}
                  {docsTip()}
                </>
              }
              labelWidth={LABEL_WIDTH}
              disabled={dataSourceConfig.readOnly}
            >
              <InlineSwitch
                id="http-settings-with-credentials"
                value={dataSourceConfig.withCredentials}
                onChange={(event) => {
                  onSettingsChange({ withCredentials: event!.currentTarget.checked });
                }}
              />
            </InlineField>

            {azureAuthSettings?.azureAuthSupported && (
              <div className="gf-form-inline">
                <InlineField
                  label="Azure Authentication"
                  tooltip={<>Use Azure authentication for Azure endpoint.</>}
                  labelWidth={LABEL_WIDTH}
                  disabled={dataSourceConfig.readOnly}
                >
                  <InlineSwitch
                    id="http-settings-azure-auth"
                    value={azureAuthEnabled}
                    onChange={(event) => {
                      onSettingsChange(
                        azureAuthSettings.setAzureAuthEnabled(dataSourceConfig, event!.currentTarget.checked)
                      );
                    }}
                  />
                </InlineField>
              </div>
            )}

            {sigV4AuthToggleEnabled && (
              <div className="gf-form-inline">
                <InlineField
                  label="SigV4 auth"
                  labelWidth={LABEL_WIDTH}
                  disabled={dataSourceConfig.readOnly}
                  tooltip={
                    <>
                      If you use an AWS Identity and Access Management (IAM) policy to control access to your Amazon
                      Elasticsearch Service domain, you must use AWS Signature Version 4 (AWS SigV4) to sign all
                      requests to that domain.{' '}
                      {docsTip(
                        'https://grafana.com/docs/grafana/latest/datasources/prometheus/#amazon-managed-service-for-prometheus'
                      )}
                    </>
                  }
                >
                  <InlineSwitch
                    id="http-settings-sigv4-auth"
                    value={dataSourceConfig.jsonData.sigV4Auth || false}
                    onChange={(event) => {
                      onSettingsChange({
                        jsonData: { ...dataSourceConfig.jsonData, sigV4Auth: event!.currentTarget.checked },
                      });
                    }}
                  />
                </InlineField>
              </div>
            )}

            {dataSourceConfig.access === 'proxy' && (
              <HttpProxySettings
                dataSourceConfig={dataSourceConfig}
                onChange={(jsonData) => onSettingsChange({ jsonData })}
                showForwardOAuthIdentityOption={showForwardOAuthIdentityOption}
              />
            )}
          </div>
        </div>
        {dataSourceConfig.basicAuth && (
          <>
            <h6>Basic Auth Details</h6>
            <div className="gf-form-group">
              <BasicAuthSettings {...props} />
            </div>
          </>
        )}

        {azureAuthSettings?.azureAuthSupported && azureAuthEnabled && azureAuthSettings.azureSettingsUI && (
          <azureAuthSettings.azureSettingsUI dataSourceConfig={dataSourceConfig} onChange={onChange} />
        )}

        {dataSourceConfig.jsonData.sigV4Auth && sigV4AuthToggleEnabled && renderSigV4Editor}
        {(dataSourceConfig.jsonData.tlsAuth || dataSourceConfig.jsonData.tlsAuthWithCACert) && (
          <TLSAuthSettings dataSourceConfig={dataSourceConfig} onChange={onChange} />
        )}
        <>
          <hr />
          <h3 className={styles.sectionHeaderPadding}>Access options</h3>
          <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
            Configure access options for this data source.
          </p>
          {showAccessOptions && (
            <>
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineField label="Access" labelWidth={26}>
                    {accessSelect}
                  </InlineField>
                </div>
                <div className="gf-form">
                  <button
                    type="button"
                    className="gf-form-label query-keyword pointer"
                    onClick={() => setIsAccessHelpVisible((isVisible) => !isVisible)}
                  >
                    Help&nbsp;
                    <Icon name={isAccessHelpVisible ? 'angle-down' : 'angle-right'} style={{ marginBottom: 0 }} />
                  </button>
                </div>
              </div>
              {isAccessHelpVisible && <HttpAccessHelp />}
            </>
          )}

          {dataSourceConfig.access === 'proxy' && (
            <div>
              <div className="gf-form">
                <InlineField
                  labelWidth={26}
                  tooltip={
                    <>
                      Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be
                      forwarded to the data source. {docsTip()}
                    </>
                  }
                  label="Allowed cookies"
                >
                  <TagsInput
                    tags={dataSourceConfig.jsonData.keepCookies}
                    width={40}
                    onChange={(cookies) =>
                      onSettingsChange({ jsonData: { ...dataSourceConfig.jsonData, keepCookies: cookies } })
                    }
                    disabled={dataSourceConfig.readOnly}
                  />
                </InlineField>
              </div>
              <div className="gf-form">
                <InlineField
                  label="Timeout"
                  labelWidth={26}
                  tooltip={<>HTTP request timeout in seconds. {docsTip()}</>}
                >
                  <Input
                    type="number"
                    placeholder="Timeout in seconds"
                    data-testid="Timeout in seconds"
                    value={dataSourceConfig.jsonData.timeout}
                    onChange={(event) => {
                      onSettingsChange({
                        jsonData: { ...dataSourceConfig.jsonData, timeout: parseInt(event.currentTarget.value, 10) },
                      });
                    }}
                    width={40}
                    disabled={dataSourceConfig.readOnly}
                  />
                </InlineField>
              </div>
            </div>
          )}
        </>

        {dataSourceConfig.access === 'proxy' && (
          <CustomHeadersSettings dataSourceConfig={dataSourceConfig} onChange={onChange} overhaulStyle={true} />
        )}
      </>
    </div>
  );
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
  };
}
