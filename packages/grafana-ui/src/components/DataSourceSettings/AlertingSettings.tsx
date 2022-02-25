import {
  AlertingDataSourceJsonData,
  AlertingSecureDataSourceJsonData,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  SecureDataSourceJsonData,
} from '@grafana/data';
import React, { useMemo, useState } from 'react';
import { omit } from 'lodash';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Select } from '../Select/Select';
import { DataSourceHttpSettings } from '..';

interface Props<JsonData, SecureJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<JsonData, SecureJsonData>, 'options' | 'onOptionsChange'> {
  alertmanagerDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  sigV4AuthEnabled: boolean;
}

export function AlertingSettings<T extends AlertingDataSourceJsonData>({
  alertmanagerDataSources,
  options,
  onOptionsChange,
}: Props<AlertingDataSourceJsonData, AlertingSecureDataSourceJsonData>): JSX.Element {
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

  const onManageAlertsToggle = (manageAlertsEnabled: boolean) => {
    const jsonData = { ...options.jsonData, manageAlerts: manageAlertsEnabled };
    if (!manageAlertsEnabled) {
      if (jsonData.ruler) {
        delete jsonData.ruler;
      }
      setCustomRulerHTTPSettings(false);
    }
    onOptionsChange({
      ...options,
      jsonData,
    });
  };

  const [customRulerHTTPSettings, setCustomRulerHTTPSettings] = useState(Boolean(options.jsonData.ruler?.url));
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
            onChange={(event) => onManageAlertsToggle(event.currentTarget.checked)}
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
        {options.jsonData.manageAlerts && (
          <div className="gf-form-inline">
            <Switch
              label="Custom ruler URL"
              labelClass="width-13"
              checked={customRulerHTTPSettings}
              onChange={(e) => onCustomRulerURLToggle(e.currentTarget.checked)}
            />
          </div>
        )}
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
      </div>
    </>
  );
}

function dataSourceSettingsToRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<AlertingDataSourceJsonData, AlertingSecureDataSourceJsonData>
): DataSourceSettings {
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
  settings: DataSourceSettings<AlertingDataSourceJsonData, AlertingSecureDataSourceJsonData>,
  rulerHTTPSettings: DataSourceSettings<DataSourceJsonData, SecureDataSourceJsonData>
): DataSourceSettings<AlertingDataSourceJsonData, AlertingSecureDataSourceJsonData> {
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
