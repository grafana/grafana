import React, { useState, useCallback } from 'react';
import { SelectableValue } from '@grafana/data';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes';
import { BasicAuthSettings } from './BasicAuthSettings';
import { HttpProxySettings } from './HttpProxySettings';
import { TLSAuthSettings } from './TLSAuthSettings';
import { DataSourceSettings } from '@grafana/data';
import { HttpSettingsProps } from './types';
import { CustomHeadersSettings } from './CustomHeadersSettings';
import { Select } from '../Forms/Legacy/Select/Select';
import { Input } from '../Forms/Legacy/Input/Input';
import { Icon } from '../Icon/Icon';
import { FormField } from '../FormField/FormField';
import { FormLabel } from '../FormLabel/FormLabel';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { TagsInput } from '../TagsInput/TagsInput';

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
        <i>Server</i>
      </strong>{' '}
      should be the preferred way if nothing else stated.
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

export const DataSourceHttpSettings: React.FC<HttpSettingsProps> = props => {
  const { defaultUrl, dataSourceConfig, onChange, showAccessOptions } = props;
  let urlTooltip;
  const [isAccessHelpVisible, setIsAccessHelpVisible] = useState(false);
  const theme = useTheme();

  const onSettingsChange = useCallback(
    (change: Partial<DataSourceSettings<any, any>>) => {
      onChange({
        ...dataSourceConfig,
        ...change,
      });
    },
    [dataSourceConfig]
  );

  switch (dataSourceConfig.access) {
    case 'direct':
      urlTooltip = (
        <>
          Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
        </>
      );
      break;
    case 'proxy':
      urlTooltip = (
        <>
          Your access method is <em>Server</em>, this means the URL needs to be accessible from the grafana
          backend/server.
        </>
      );
      break;
    default:
      urlTooltip = 'Specify a complete HTTP URL (for example http://your_server:8080)';
  }

  const accessSelect = (
    <Select
      width={20}
      options={ACCESS_OPTIONS}
      value={ACCESS_OPTIONS.filter(o => o.value === dataSourceConfig.access)[0] || DEFAULT_ACCESS_OPTION}
      onChange={selectedValue => onSettingsChange({ access: selectedValue.value })}
    />
  );

  const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
    dataSourceConfig.url
  );

  const notValidStyle = css`
    box-shadow: inset 0 0px 5px ${theme.palette.red};
  `;

  const inputStyle = cx({ [`width-20`]: true, [notValidStyle]: !isValidUrl });

  const urlInput = (
    <Input
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.url}
      onChange={event => onSettingsChange({ url: event.currentTarget.value })}
    />
  );

  return (
    <div className="gf-form-group">
      <>
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <FormField label="URL" labelWidth={11} tooltip={urlTooltip} inputEl={urlInput} />
          </div>

          {showAccessOptions && (
            <>
              <div className="gf-form-inline">
                <div className="gf-form">
                  <FormField label="Access" labelWidth={11} inputWidth={20} inputEl={accessSelect} />
                </div>
                <div className="gf-form">
                  <label
                    className="gf-form-label query-keyword pointer"
                    onClick={() => setIsAccessHelpVisible(isVisible => !isVisible)}
                  >
                    Help&nbsp;
                    <Icon name={isAccessHelpVisible ? 'angle-down' : 'angle-right'} style={{ marginBottom: 0 }} />
                  </label>
                </div>
              </div>
              {isAccessHelpVisible && <HttpAccessHelp />}
            </>
          )}
          {dataSourceConfig.access === 'proxy' && (
            <div className="gf-form">
              <FormLabel
                width={11}
                tooltip="Grafana Proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source."
              >
                Whitelisted Cookies
              </FormLabel>
              <TagsInput
                tags={dataSourceConfig.jsonData.keepCookies}
                onChange={cookies =>
                  onSettingsChange({ jsonData: { ...dataSourceConfig.jsonData, keepCookies: cookies } })
                }
                width={20}
              />
            </div>
          )}
        </div>
      </>

      <>
        <h3 className="page-heading">Auth</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <Switch
              label="Basic auth"
              labelClass="width-13"
              checked={dataSourceConfig.basicAuth}
              onChange={event => {
                onSettingsChange({ basicAuth: event!.currentTarget.checked });
              }}
            />
            <Switch
              label="With Credentials"
              labelClass="width-13"
              checked={dataSourceConfig.withCredentials}
              onChange={event => {
                onSettingsChange({ withCredentials: event!.currentTarget.checked });
              }}
              tooltip="Whether credentials such as cookies or auth headers should be sent with cross-site requests."
            />
          </div>

          {dataSourceConfig.access === 'proxy' && (
            <HttpProxySettings
              dataSourceConfig={dataSourceConfig}
              onChange={jsonData => onSettingsChange({ jsonData })}
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

        {(dataSourceConfig.jsonData.tlsAuth || dataSourceConfig.jsonData.tlsAuthWithCACert) && (
          <TLSAuthSettings dataSourceConfig={dataSourceConfig} onChange={onChange} />
        )}

        {dataSourceConfig.access === 'proxy' && (
          <CustomHeadersSettings dataSourceConfig={dataSourceConfig} onChange={onChange} />
        )}
      </>
    </div>
  );
};
