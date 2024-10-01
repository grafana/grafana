import { css, cx } from '@emotion/css';
import { useState, useCallback, useId } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes';
import { Alert } from '../Alert/Alert';
import { FormField } from '../FormField/FormField';
import { InlineFormLabel } from '../FormLabel/FormLabel';
import { InlineField } from '../Forms/InlineField';
import { Input } from '../Forms/Legacy/Input/Input';
import { Icon } from '../Icon/Icon';
import { Select } from '../Select/Select';
import { InlineSwitch } from '../Switch/Switch';
import { TagsInput } from '../TagsInput/TagsInput';
import { Text } from '../Text/Text';

import { BasicAuthSettings } from './BasicAuthSettings';
import { CustomHeadersSettings } from './CustomHeadersSettings';
import { HttpProxySettings } from './HttpProxySettings';
import { SecureSocksProxySettings } from './SecureSocksProxySettings';
import { TLSAuthSettings } from './TLSAuthSettings';
import { HttpSettingsProps } from './types';

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

const HttpAccessHelp = () => {
  return (
    <Alert severity="info" title="" topSpacing={3}>
      <p>
        Access mode controls how requests to the data source will be handled.
        <strong>
          &nbsp;<i>Server</i>
        </strong>{' '}
        should be the preferred way if nothing else is stated.
      </p>
      <Text weight="medium">Server access mode (Default):</Text>
      <p>
        All requests will be made from the browser to Grafana backend/server which in turn will forward the requests to
        the data source and by that circumvent possible Cross-Origin Resource Sharing (CORS) requirements. The URL needs
        to be accessible from the grafana backend/server if you select this access mode.
      </p>
      <Text weight="medium">Browser access mode:</Text>
      <p>
        All requests will be made from the browser directly to the data source and may be subject to Cross-Origin
        Resource Sharing (CORS) requirements. The URL needs to be accessible from the browser if you select this access
        mode.
      </p>
    </Alert>
  );
};

const LABEL_WIDTH = 26;

export const DataSourceHttpSettings = (props: HttpSettingsProps) => {
  const {
    defaultUrl,
    dataSourceConfig,
    onChange,
    showAccessOptions,
    sigV4AuthToggleEnabled,
    showForwardOAuthIdentityOption,
    azureAuthSettings,
    renderSigV4Editor,
    secureSocksDSProxyEnabled,
    urlLabel,
    urlDocs,
  } = props;

  const [isAccessHelpVisible, setIsAccessHelpVisible] = useState(false);
  const [azureAuthEnabled, setAzureAuthEnabled] = useState(false);
  const theme = useTheme2();
  let urlTooltip;

  const onSettingsChange = useCallback(
    (change: Partial<typeof dataSourceConfig>) => {
      // Azure Authentication doesn't work correctly when Forward OAuth Identity is enabled.
      // The Authorization header that has been set by the ApplyAzureAuth middleware gets overwritten
      // with the Authorization header set by the OAuthTokenMiddleware.
      const isAzureAuthEnabled =
        (azureAuthSettings?.azureAuthSupported && azureAuthSettings.getAzureAuthEnabled(dataSourceConfig)) || false;
      setAzureAuthEnabled(isAzureAuthEnabled);
      if (isAzureAuthEnabled) {
        const tmpOauthPassThru =
          dataSourceConfig.jsonData.oauthPassThru !== undefined ? dataSourceConfig.jsonData.oauthPassThru : false;
        change = {
          ...change,
          jsonData: {
            ...dataSourceConfig.jsonData,
            oauthPassThru: isAzureAuthEnabled ? false : tmpOauthPassThru,
          },
        };
      }

      onChange({
        ...dataSourceConfig,
        ...change,
      });
    },
    [azureAuthSettings, dataSourceConfig, onChange]
  );

  switch (dataSourceConfig.access) {
    case 'direct':
      urlTooltip = (
        <>
          Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          {urlDocs}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = (
        <>
          Your access method is <em>Server</em>, this means the URL needs to be accessible from the grafana
          backend/server.
          {urlDocs}
        </>
      );
      break;
    default:
      urlTooltip = <>Specify a complete HTTP URL (for example http://your_server:8080) {urlDocs}</>;
  }

  const accessSelect = (
    <Select
      aria-label="Access"
      className="width-20 gf-form-input"
      options={ACCESS_OPTIONS}
      value={ACCESS_OPTIONS.filter((o) => o.value === dataSourceConfig.access)[0] || DEFAULT_ACCESS_OPTION}
      onChange={(selectedValue) => onSettingsChange({ access: selectedValue.value })}
      disabled={dataSourceConfig.readOnly}
    />
  );

  const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
    dataSourceConfig.url
  );

  const notValidStyle = css({
    boxShadow: `inset 0 0px 5px ${theme.v1.palette.red}`,
  });

  const inputStyle = cx({ [`width-20`]: true, [notValidStyle]: !isValidUrl });

  const fromFieldId = useId();

  const urlInput = (
    <Input
      id={fromFieldId}
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.url}
      data-testid={selectors.components.DataSource.DataSourceHttpSettings.urlInput}
      onChange={(event) => onSettingsChange({ url: event.currentTarget.value })}
      disabled={dataSourceConfig.readOnly}
    />
  );

  return (
    <div className="gf-form-group">
      <>
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <FormField
              interactive={urlDocs ? true : false}
              label={urlLabel ?? 'URL'}
              labelWidth={13}
              tooltip={urlTooltip}
              inputEl={urlInput}
            />
          </div>

          {showAccessOptions && (
            <>
              <div className="gf-form-inline">
                <div className="gf-form">
                  <FormField label="Access" labelWidth={13} inputWidth={20} inputEl={accessSelect} />
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
            <div className="gf-form-group">
              <div className="gf-form">
                <InlineFormLabel
                  width={13}
                  tooltip="Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source."
                >
                  Allowed cookies
                </InlineFormLabel>
                <TagsInput
                  tags={dataSourceConfig.jsonData.keepCookies}
                  width={40}
                  onChange={(cookies) =>
                    onSettingsChange({ jsonData: { ...dataSourceConfig.jsonData, keepCookies: cookies } })
                  }
                  disabled={dataSourceConfig.readOnly}
                />
              </div>
              <div className="gf-form">
                <FormField
                  label="Timeout"
                  type="number"
                  labelWidth={13}
                  inputWidth={20}
                  tooltip="HTTP request timeout in seconds"
                  placeholder="Timeout in seconds"
                  aria-label="Timeout in seconds"
                  value={dataSourceConfig.jsonData.timeout}
                  onChange={(event) => {
                    onSettingsChange({
                      jsonData: { ...dataSourceConfig.jsonData, timeout: parseInt(event.currentTarget.value, 10) },
                    });
                  }}
                  disabled={dataSourceConfig.readOnly}
                />
              </div>
            </div>
          )}
        </div>
      </>

      <>
        <h3 className="page-heading">Auth</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <InlineField label="Basic auth" labelWidth={LABEL_WIDTH} disabled={dataSourceConfig.readOnly}>
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
              tooltip="Whether credentials such as cookies or auth headers should be sent with cross-site requests."
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
          </div>

          {azureAuthSettings?.azureAuthSupported && (
            <div className="gf-form-inline">
              <InlineField
                label="Azure Authentication"
                tooltip="Use Azure authentication for Azure endpoint."
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
              <InlineField label="SigV4 auth" labelWidth={LABEL_WIDTH} disabled={dataSourceConfig.readOnly}>
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
              showForwardOAuthIdentityOption={azureAuthEnabled ? false : showForwardOAuthIdentityOption}
            />
          )}
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

        {dataSourceConfig.access === 'proxy' && (
          <CustomHeadersSettings dataSourceConfig={dataSourceConfig} onChange={onChange} />
        )}
      </>
      {secureSocksDSProxyEnabled && <SecureSocksProxySettings options={dataSourceConfig} onOptionsChange={onChange} />}
    </div>
  );
};
