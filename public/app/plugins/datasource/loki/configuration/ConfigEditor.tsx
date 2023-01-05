import React from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  onUpdateDatasourceJsonDataOptionChecked,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { AlertingSettings, DataSourceHttpSettings, InlineField, InlineSwitch } from '@grafana/ui';

import { LokiOptions } from '../types';

import { DerivedFields } from './DerivedFields';
import { MaxLinesField } from './MaxLinesField';

export type Props = DataSourcePluginOptionsEditorProps<LokiOptions>;

const makeJsonUpdater =
  <T extends any>(field: keyof LokiOptions) =>
  (options: DataSourceSettings<LokiOptions>, value: T): DataSourceSettings<LokiOptions> => {
    return {
      ...options,
      jsonData: {
        ...options.jsonData,
        [field]: value,
      },
    };
  };

const setMaxLines = makeJsonUpdater('maxLines');
const setDerivedFields = makeJsonUpdater('derivedFields');

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const socksProxy = config.featureToggles.secureSocksDatasourceProxy;

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:3100'}
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
      />

      {socksProxy && (
        <>
          <h3 className="page-heading">Secure Socks Proxy</h3>
          <div className="gf-form-group">
            <div className="gf-form-inline"></div>
            <InlineField
              labelWidth={28}
              label="Enabled"
              tooltip="Connect to this datasource via the secure socks proxy."
            >
              <InlineSwitch
                value={options.jsonData.enableSecureSocksProxy ?? false}
                onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'enableSecureSocksProxy')}
              />
            </InlineField>
          </div>
        </>
      )}

      <AlertingSettings<LokiOptions> options={options} onOptionsChange={onOptionsChange} />

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <MaxLinesField
              value={options.jsonData.maxLines || ''}
              onChange={(value) => onOptionsChange(setMaxLines(options, value))}
            />
          </div>
        </div>
      </div>

      <DerivedFields
        value={options.jsonData.derivedFields}
        onChange={(value) => onOptionsChange(setDerivedFields(options, value))}
      />
    </>
  );
};
