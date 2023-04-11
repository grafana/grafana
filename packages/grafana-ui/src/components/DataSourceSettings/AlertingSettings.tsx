import React from 'react';

import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';

import { InlineSwitch } from '../../components/Switch/Switch';
import { InlineField } from '../Forms/InlineField';

export interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

export interface AlertingConfig extends DataSourceJsonData {
  manageAlerts?: boolean;
}

export function AlertingSettings<T extends AlertingConfig>({ options, onOptionsChange }: Props<T>): JSX.Element {
  return (
    <>
      <h3 className="page-heading">Alerting</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              labelWidth={27}
              label="Manage alert rules in Alerting UI"
              disabled={options.readOnly}
              tooltip="Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data source."
            >
              <InlineSwitch
                value={options.jsonData.manageAlerts !== false}
                onChange={(event) =>
                  onOptionsChange({
                    ...options,
                    jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
                  })
                }
              />
            </InlineField>
          </div>
        </div>
      </div>
    </>
  );
}
