import { uniqueId } from 'lodash';
import React from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Alert, InlineFormLabel, LegacyForms, Select } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

const { Input, SecretFormField } = LegacyForms;

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
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel htmlFor={`${htmlPrefix}-db`} className="width-10">
            Database
          </InlineFormLabel>
          <div className="width-20">
            <Input
              id={`${htmlPrefix}-db`}
              className="width-20"
              value={jsonData.dbName ?? database}
              onChange={(event) => {
                onOptionsChange({
                  ...options,
                  database: '',
                  jsonData: {
                    ...jsonData,
                    dbName: event.target.value,
                  },
                });
              }}
            />
          </div>
        </div>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel htmlFor={`${htmlPrefix}-user`} className="width-10">
            User
          </InlineFormLabel>
          <div className="width-10">
            <Input
              id={`${htmlPrefix}-user`}
              className="width-20"
              value={options.user || ''}
              onChange={onUpdateDatasourceOption(props, 'user')}
            />
          </div>
        </div>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form">
          <SecretFormField
            isConfigured={Boolean(secureJsonFields && secureJsonFields.password)}
            value={secureJsonData?.password || ''}
            label="Password"
            aria-label="Password"
            labelWidth={10}
            inputWidth={20}
            onReset={() => updateDatasourcePluginResetOption(props, 'password')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          />
        </div>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel
            htmlFor={`${htmlPrefix}-http-method`}
            className="width-10"
            tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
          will restrict you and return an error if the query is too large."
          >
            HTTP Method
          </InlineFormLabel>
          <Select
            inputId={`${htmlPrefix}-http-method`}
            className="width-20"
            value={httpModes.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
            options={httpModes}
            defaultValue={options.jsonData.httpMode}
            onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'httpMode')}
          />
        </div>
      </div>

      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel
            className="width-10"
            tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
          >
            Min time interval
          </InlineFormLabel>
          <div className="width-10">
            <Input
              className="width-20"
              placeholder="10s"
              value={options.jsonData.timeInterval || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
            />
          </div>
        </div>
      </div>
    </>
  );
};
