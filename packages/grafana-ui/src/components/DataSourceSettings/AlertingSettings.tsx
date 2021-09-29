import { DataSourceInstanceSettings, DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import React, { useMemo } from 'react';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Select } from '../Select/Select';

interface Props<T> extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {
  alertmanagerDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
}

interface AlertingConfig extends DataSourceJsonData {
  manageAlerts?: boolean;
}

export function AlertingSettings<T extends AlertingConfig>({
  alertmanagerDataSources,
  options,
  onOptionsChange,
}: Props<T>): JSX.Element {
  const alertmanagerOptions = useMemo(
    () =>
      alertmanagerDataSources.map((ds) => ({
        label: ds.name.substr(0, 37),
        value: ds.name,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      })),
    [alertmanagerDataSources]
  );

  return (
    <>
      <h3 className="page-heading">Alerting</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <Switch
              label="Manage alerts via Alerting UI"
              labelClass="width-13"
              checked={options.jsonData.manageAlerts !== false}
              onChange={(event) =>
                onOptionsChange({
                  ...options,
                  jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
                })
              }
            />
          </div>
        </div>
        {(options.type === 'loki' || options.type === 'prometheus') && (
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
                  onOptionsChange({ ...options, jsonData: { ...options.jsonData, alertmanager: value?.value } })
                }
                value={options.jsonData.alertmanager}
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </div>
    </>
  );
}
