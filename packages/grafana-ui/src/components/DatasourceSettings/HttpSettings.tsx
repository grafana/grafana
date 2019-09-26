import React, { useState, useCallback } from 'react';
import { DataSourceSettings } from '../../types';
import { FormField } from '../FormField/FormField';
import Select from '../Select/Select';
import { SelectableValue } from '@grafana/data';
import { Switch } from '../Switch/Switch';
import { DatasourceHttpSettingsProps } from './types';
import { DatasourceHttpBasicAuthSettings } from './BasicAuthSettings';
import { DatasourceHttpProxySettings } from './HttpProxySettings';
import { DatasourceTLSAuthSettings } from './TLSAuthSettings';

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

const DatasourceHttpAccessHelp = () => (
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

export const DatasourceHttpSettings: React.FC<DatasourceHttpSettingsProps> = props => {
  const { defaultUrl, datasourceConfig, onChange, showAccessOptions } = props;
  let urlTooltip;
  const [isAccessHelpVisible, setIsAccessHelpVisible] = useState(false);

  const onSettingsChange = useCallback(
    (change: Partial<DataSourceSettings<any, any>>) => {
      onChange({
        ...datasourceConfig,
        ...change,
      });
    },
    [datasourceConfig]
  );

  switch (datasourceConfig.access) {
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
      value={ACCESS_OPTIONS.filter(o => o.value === datasourceConfig.access)[0] || DEFAULT_ACCESS_OPTION}
      onChange={selectedValue => onSettingsChange({ access: selectedValue.value })}
    />
  );

  const cookieTagsInput = <strong>TODO: migrate bootstrap-tagsinput</strong>;

  return (
    <div className="gf-form-group">
      <>
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form-group">
          <div className="gf-form max-width-30">
            <FormField
              label="URL"
              labelWidth={11}
              inputWidth={20}
              placeholder={defaultUrl}
              value={datasourceConfig.url}
              tooltip={urlTooltip}
              onChange={event => onSettingsChange({ url: event.currentTarget.value })}
            />
          </div>

          {showAccessOptions && (
            <>
              <div className="gf-form-inline">
                <div className="gf-form max-width-30">
                  <FormField
                    label="Access"
                    labelWidth={11}
                    inputWidth={30}
                    placeholder={defaultUrl}
                    value={datasourceConfig.url}
                    inputEl={accessSelect}
                  />
                </div>
                <div className="gf-form">
                  <label
                    className="gf-form-label query-keyword pointer"
                    onClick={() => setIsAccessHelpVisible(isVisible => !isVisible)}
                  >
                    Help&nbsp;
                    <i className={`fa fa-caret-${isAccessHelpVisible ? 'down' : 'right'}`} />
                  </label>
                </div>
              </div>
              {isAccessHelpVisible && <DatasourceHttpAccessHelp />}
            </>
          )}
          {datasourceConfig.access === 'proxy' && (
            <div className="gf-form max-width-30">
              {/* keepCookies is an array of strings*/}
              <FormField
                label="Whitelisted Cookies"
                labelWidth={11}
                value={datasourceConfig.jsonData.keepCookies}
                inputEl={cookieTagsInput}
                tooltip="Grafana Proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source."
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
              checked={datasourceConfig.basicAuth}
              onChange={event => {
                onSettingsChange({ basicAuth: event!.currentTarget.checked });
              }}
            />
            <Switch
              label="With Credentials"
              labelClass="width-13"
              checked={datasourceConfig.withCredentials}
              onChange={event => {
                onSettingsChange({ withCredentials: event!.currentTarget.checked });
              }}
              tooltip="Whether credentials such as cookies or auth headers should be sent with cross-site requests."
            />
          </div>

          {datasourceConfig.access === 'proxy' && (
            <DatasourceHttpProxySettings
              datasourceConfig={datasourceConfig}
              onChange={jsonData => onSettingsChange({ jsonData })}
            />
          )}
        </div>
        {datasourceConfig.basicAuth && (
          <>
            <h6>Basic Auth Details</h6>
            <div className="gf-form-group">
              <DatasourceHttpBasicAuthSettings {...props} />
            </div>
          </>
        )}

        {<DatasourceTLSAuthSettings datasourceConfig={datasourceConfig} onChange={onChange} />}
      </>
    </div>
  );
};
