import React, { PureComponent, ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings, SelectableValue } from '@grafana/data';
import { DataSourceHttpSettings, FormLabel, Input, SecretFormField, Select } from '@grafana/ui';
import { InfluxOptions, InfluxSecureJsonData } from '../types';

const httpModes = [{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }];

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

type InfluxDataSourceSettings = DataSourceSettings<InfluxOptions, InfluxSecureJsonData>;

export interface State {
  config: InfluxDataSourceSettings;
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;

    this.state = {
      config: ConfigEditor.defaults(options),
    };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: ConfigEditor.defaults(props.options),
    };
  }

  static defaults = (options: InfluxDataSourceSettings) => {
    options.secureJsonData = options.secureJsonData || {};
    options.secureJsonData.password = options.secureJsonData.password || '';
    return options;
  };

  onDatabaseChange = (database: string) => {
    this.props.onOptionsChange({
      ...this.state.config,
      database,
    });
  };

  onUserChange = (user: string) => {
    this.props.onOptionsChange({
      ...this.state.config,
      user,
    });
  };

  onPasswordChange = (password: string) => {
    this.props.onOptionsChange({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        password,
      },
    });
  };

  onTimeIntervalChange = (timeInterval: string) => {
    this.props.onOptionsChange({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        timeInterval,
      },
    });
  };

  onResetPassword = () => {
    this.props.onOptionsChange({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        password: false,
      },
    });
  };

  onHttpModeSelect = (httpMode: SelectableValue<string>) => {
    this.props.onOptionsChange({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        httpMode: httpMode.value,
      },
    });
  };

  render() {
    const { config } = this.state;
    return (
      <>
        <DataSourceHttpSettings
          showAccessOptions={true}
          dataSourceConfig={config}
          defaultUrl="http://localhost:8086"
          onChange={this.props.onOptionsChange}
        />

        <h3 className="page-heading">InfluxDB Details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-10">Database</FormLabel>
              <div className="width-20">
                <Input
                  className="width-20"
                  value={config.database || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onDatabaseChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-10">User</FormLabel>
              <div className="width-10">
                <Input
                  className="width-20"
                  value={config.user || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onUserChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <SecretFormField
                isConfigured={config.secureJsonFields.password || false}
                value={config.secureJsonData.password}
                label="Password"
                labelWidth={10}
                inputWidth={20}
                onReset={this.onResetPassword}
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onPasswordChange(event.target.value)}
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
                value={httpModes.find(httpMode => httpMode.value === config.jsonData.httpMode)}
                options={httpModes}
                defaultValue={config.jsonData.httpMode}
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
                  value={config.jsonData.timeInterval || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onTimeIntervalChange(event.target.value)}
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
