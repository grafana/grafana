import { uniqueId } from 'lodash';
import React, { FormEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Alert, InlineFieldRow, InlineField, Select, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

const WIDTH_SHORT = 20;

const httpModes: SelectableValue[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
];

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxInfluxQLConfig = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { database, jsonData, secureJsonData, secureJsonFields } = options;
  const htmlPrefix = uniqueId('influxdb-influxql-config');

  return (
    <>
      <Alert severity="info" title="Database Access">
        <p>
          Setting the database for this datasource does not deny access to other databases. The InfluxDB query syntax
          allows switching the database in the query. For example:
          <code>SHOW MEASUREMENTS ON _internal</code> or
          <code>SELECT * FROM &quot;_internal&quot;..&quot;database&quot; LIMIT 10</code>
          <br />
          <br />
          To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.
        </p>
      </Alert>

      <InlineFieldRow>
        <InlineField labelWidth={WIDTH_SHORT} label="Database" htmlFor={`${htmlPrefix}-db`}>
          <Input
            id={`${htmlPrefix}-db`}
            className="width-20"
            value={jsonData.dbName ?? database}
            onChange={(event: FormEvent<HTMLInputElement>) => {
              onOptionsChange({
                ...options,
                database: '',
                jsonData: {
                  ...jsonData,
                  dbName: event.currentTarget.value,
                },
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField labelWidth={WIDTH_SHORT} label="User" htmlFor={`${htmlPrefix}-user`}>
          <Input
            id={`${htmlPrefix}-user`}
            className="width-20"
            value={options.user || ''}
            onChange={onUpdateDatasourceOption(props, 'user')}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField labelWidth={WIDTH_SHORT} label="Password">
          <SecretInput
            isConfigured={Boolean(secureJsonFields && secureJsonFields.password)}
            value={secureJsonData?.password || ''}
            label="Password"
            aria-label="Password"
            className={'width-20'}
            onReset={() => updateDatasourcePluginResetOption(props, 'password')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          labelWidth={WIDTH_SHORT}
          label="HTTP Method"
          htmlFor={`${htmlPrefix}-http-method`}
          tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
          will restrict you and return an error if the query is too large."
        >
          <Select
            inputId={`${htmlPrefix}-http-method`}
            className="width-20"
            value={httpModes.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
            options={httpModes}
            defaultValue={options.jsonData.httpMode}
            onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'httpMode')}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          labelWidth={WIDTH_SHORT}
          label="Min time interval"
          tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
        >
          <Input
            className="width-20"
            placeholder="10s"
            value={options.jsonData.timeInterval || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
