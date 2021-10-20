import {
  AlertingUIDataSourceJsonData,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
} from '@grafana/data';
import React, { useMemo, useState } from 'react';
import { omit } from 'lodash';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Select } from '../Select/Select';
import { DataSourceHttpSettings } from '..';

interface Props<T> extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {
  alertmanagerDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  sigV4AuthEnabled: boolean;
}

export function AlertingSettings<T extends AlertingUIDataSourceJsonData>({
  alertmanagerDataSources,
  options,
  onOptionsChange,
  sigV4AuthEnabled,
}: Props<T>): JSX.Element {
  const alertmanagerOptions = useMemo(
    () =>
      alertmanagerDataSources.map((ds) => ({
        label: ds.name,
        value: ds.uid,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      })),
    [alertmanagerDataSources]
  );

  const [customRulerHTTPSettings, setCustomRulerHTTPSettings] = useState(!!options.jsonData.ruler?.url);
  const onCustomRulerURLToggle = (checked: boolean) => {
    setCustomRulerHTTPSettings(checked);
    if (!checked) {
      onOptionsChange({
        ...options,
        jsonData: {
          ...(omit(options.jsonData, 'ruler') as T),
        },
        secureJsonData: omit(options.secureJsonData ?? {}, 'rulerBasicAuthPassword'),
        secureJsonFields: omit(options.secureJsonFields, 'rulerBasicAuthPassword'),
      });
    }
  };
  return (
    <>
      <h3 className="page-heading">Alerting</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <Switch
            label="Manage alerts via Alerting UI"
            labelClass="width-13"
            checked={options.jsonData.manageAlerts !== false}
            onChange={(event) => {
              const checked = !!event!.currentTarget.checked;
              let jsonData = { ...options.jsonData, manageAlerts: checked };
              if (!checked) {
                if (jsonData.ruler) {
                  delete jsonData.ruler;
                }
                setCustomRulerHTTPSettings(false);
              }
              onOptionsChange({
                ...options,
                jsonData,
              });
            }}
          />
        </div>
        <InlineFieldRow>
          <InlineField
            tooltip="The alertmanager that manages alerts for this data source"
            label="Alertmanager data source"
            labelWidth={26}
          >
            <Select
              width={29}
              menuShouldPortal
              options={alertmanagerOptions}
              onChange={(value) =>
                onOptionsChange({ ...options, jsonData: { ...options.jsonData, alertmanagerUid: value?.value } })
              }
              value={options.jsonData.alertmanagerUid}
            />
          </InlineField>
        </InlineFieldRow>
        {options.jsonData.manageAlerts !== false && (
          <div className="gf-form-inline">
            <Switch
              label="Custom ruler URL"
              labelClass="width-13"
              checked={customRulerHTTPSettings}
              onChange={(e) => onCustomRulerURLToggle(!!e.currentTarget.checked)}
            />
          </div>
        )}
      </div>
      {customRulerHTTPSettings && (
        <div className="page-body">
          <DataSourceHttpSettings
            title="Ruler"
            defaultUrl="http://localhost:9090/ruler"
            dataSourceConfig={dataSourceSettingsToRulerHTTPDataSourceSettings(options)}
            showAccessOptions={false}
            onChange={(data) => onOptionsChange(mergeInRulerHTTPDataSourceSettings(options, data))}
            sigV4AuthToggleEnabled={false}
            proxySettingsEnabled={false}
            withCredentialsToggleEnabled={false}
          />
        </div>
      )}
    </>
  );
}

function dataSourceSettingsToRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<any, any>
): DataSourceSettings<any, any> {
  const {
    url = '',
    basicAuth = false,
    withCredentials = false,
    basicAuthPassword = '',
    basicAuthUser = '',
    ...jsonData
  } = settings.jsonData.ruler ?? {};
  return {
    ...settings,
    access: 'server',
    url,
    basicAuth,
    withCredentials,
    basicAuthPassword,
    basicAuthUser,
    jsonData,
    secureJsonData:
      settings.secureJsonData?.rulerBasicAuthPassword !== undefined
        ? {
            basicAuthPassword: settings.secureJsonData.rulerBasicAuthPassword,
          }
        : {},
    secureJsonFields: {
      basicAuthPassword: settings.secureJsonFields.rulerBasicAuthPassword,
    },
  };
}

function mergeInRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<any, any>,
  rulerHTTPSettings: DataSourceSettings<any, any>
): DataSourceSettings<any, any> {
  const out = {
    ...settings,
    jsonData: {
      ...settings.jsonData,
      ruler: {
        ...rulerHTTPSettings.jsonData,
        url: rulerHTTPSettings.url,
        basicAuth: rulerHTTPSettings.basicAuth,
        basicAuthPassword: rulerHTTPSettings.basicAuthPassword,
        basicAuthUser: rulerHTTPSettings.basicAuthUser,
        withCredentials: rulerHTTPSettings.withCredentials,
      },
    },
    secureJsonFields: {
      ...settings.secureJsonFields,
      rulerBasicAuthPassword: rulerHTTPSettings.secureJsonFields.basicAuthPassword,
    },
    secureJsonData: {
      ...settings.secureJsonData,
      rulerBasicAuthPassword: rulerHTTPSettings.secureJsonData?.basicAuthPassword,
    },
  };
  return out;
}
