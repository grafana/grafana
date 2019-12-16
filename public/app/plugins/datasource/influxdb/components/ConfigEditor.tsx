import React, { PureComponent, ChangeEvent } from 'react';
import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetKeyOption,
  updateDatasourcePluginOption,
} from '@grafana/data';
import { DataSourceHttpSettings, FormLabel, Input, SecretFormField, Select } from '@grafana/ui';
import { InfluxOptions, InfluxSecureJsonData } from '../types';

const httpModes = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
] as SelectableValue[];

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export class ConfigEditor extends PureComponent<Props> {
  onUpdateOption = (key: string, val: any) => {
    updateDatasourcePluginOption(this.props, key, val);
  };

  onUpdateJsonDataOption = (key: string, val: any, secure: boolean) => {
    updateDatasourcePluginJsonDataOption(this.props, key, val, secure);
  };

  onResetKey = (key: string) => {
    updateDatasourcePluginResetKeyOption(this.props, key);
  };

  onDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateOption('database', event.target.value);
  };

  onUserChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateOption('user', event.target.value);
  };

  onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateJsonDataOption('password', event.target.value, true);
  };

  onTimeIntervalChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.onUpdateJsonDataOption('timeInterval', event.target.value, false);
  };

  onResetPassword = () => {
    this.onResetKey('password');
  };

  onHttpModeSelect = (httpMode: SelectableValue) => {
    this.onUpdateJsonDataOption('httpMode', httpMode.value, false);
  };

  render() {
    const { options, onOptionsChange } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as InfluxSecureJsonData;
    return (
      <>
        <DataSourceHttpSettings
          showAccessOptions={true}
          dataSourceConfig={options}
          defaultUrl="http://localhost:8086"
          onChange={onOptionsChange}
        />

        <h3 className="page-heading">InfluxDB Details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-10">Database</FormLabel>
              <div className="width-20">
                <Input className="width-20" value={options.database || ''} onChange={this.onDatabaseChange} />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-10">User</FormLabel>
              <div className="width-10">
                <Input className="width-20" value={options.user || ''} onChange={this.onUserChange} />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <SecretFormField
                isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
                value={secureJsonData.password || ''}
                label="Password"
                labelWidth={10}
                inputWidth={20}
                onReset={this.onResetPassword}
                onChange={this.onPasswordChange}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel
                className="width-10"
                tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
          will restrict you and return an error if the query is too large."
              >
                HTTP Method
              </FormLabel>
              <Select
                className="width-10"
                value={httpModes.find(httpMode => httpMode.value === options.jsonData.httpMode)}
                options={httpModes}
                defaultValue={options.jsonData.httpMode}
                onChange={this.onHttpModeSelect}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-group">
          <div className="grafana-info-box">
            <h5>Database Access</h5>
            <p>
              Setting the database for this datasource does not deny access to other databases. The InfluxDB query
              syntax allows switching the database in the query. For example:
              <code>SHOW MEASUREMENTS ON _internal</code> or <code>SELECT * FROM "_internal".."database" LIMIT 10</code>
              <br />
              <br />
              To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.
            </p>
          </div>
        </div>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel
                className="width-10"
                tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
              >
                Min time interval
              </FormLabel>
              <div className="width-10">
                <Input
                  className="width-10"
                  placeholder="10s"
                  value={options.jsonData.timeInterval || ''}
                  onChange={this.onTimeIntervalChange}
                />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default ConfigEditor;
