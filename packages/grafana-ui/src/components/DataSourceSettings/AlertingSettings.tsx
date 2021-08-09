import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import React from 'react';
import { Switch } from '../Forms/Legacy/Switch/Switch';

type Props<T> = Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'>;

export function AlertingSettings<T extends { manageAlerts?: boolean }>({
  options,
  onOptionsChange,
}: Props<T>): JSX.Element {
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
      </div>
    </>
  );
}
