import React, { PureComponent } from 'react';
import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  onUpdateDatasourceOption,
  updateDatasourcePluginResetOption,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceSecureJsonDataOption,
} from '@grafana/data';
import { DataSourceHttpSettings, InlineFormLabel, LegacyForms } from '@grafana/ui';
const { Select, Input, SecretFormField } = LegacyForms;
import { InfluxOptions, InfluxSecureJsonData, InfluxVersion } from '../types';

const httpModes = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
] as SelectableValue[];

const versions = [
  {
    label: 'InfluxQL',
    value: InfluxVersion.InfluxQL,
    description: 'The InfluxDB SQL-like query language.  Supported in InfluxDB 1.x',
  },
  {
    label: 'Flux',
    value: InfluxVersion.Flux,
    description: 'Advanced data scripting and query language.  Supported in InfluxDB 2.x and 1.8+ (beta)',
  },
] as Array<SelectableValue<InfluxVersion>>;

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export class ConfigEditor extends PureComponent<Props> {
  // 1x
  onResetPassword = () => {
    updateDatasourcePluginResetOption(this.props, 'password');
  };

  // 2x
  onResetToken = () => {
    updateDatasourcePluginResetOption(this.props, 'token');
  };

  onVersionChanged = (selected: SelectableValue<InfluxVersion>) => {
    const { options, onOptionsChange } = this.props;

    const copy: any = {
      ...options,
      jsonData: {
        ...options.jsonData,
        version: selected.value,
      },
    };
    if (selected.value === InfluxVersion.Flux) {
      copy.access = 'proxy';
      copy.basicAuth = true;
      copy.jsonData.httpMode = 'POST';

      // Remove old 1x configs
      delete copy.user;
      delete copy.database;
    }
    onOptionsChange(copy);
  };

  onUpdateInflux2xURL = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const { options, onOptionsChange } = this.props;
    onOptionsChange({
      ...options,
      url: e.currentTarget.value,
      access: 'proxy',
      basicAuth: true,
    });
  };

  renderInflux2x() {
    const { options } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as InfluxSecureJsonData;

    return (
      <div>
        <div className="gf-form-group">
          <div className="width-30 grafana-info-box">
            <h5>Support for flux in Grafana is currently in beta</h5>
            <p>
              Please report any issues to: <br />
              <a href="https://github.com/grafana/grafana/issues/new/choose">
                https://github.com/grafana/grafana/issues
              </a>
            </p>
          </div>
        </div>
        <br />

        <h3 className="page-heading">Connection</h3>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              className="width-10"
              tooltip="This URL needs to be accessible from the grafana backend/server."
            >
              URL
            </InlineFormLabel>
            <div className="width-20">
              <Input
                className="width-20"
                value={options.url || ''}
                placeholder="http://localhost:9999"
                onChange={this.onUpdateInflux2xURL}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel className="width-10">Organization</InlineFormLabel>
            <div className="width-10">
              <Input
                className="width-20"
                value={options.jsonData.organization || ''}
                onChange={onUpdateDatasourceJsonDataOption(this.props, 'organization')}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField
              isConfigured={(secureJsonFields && secureJsonFields.token) as boolean}
              value={secureJsonData.token || ''}
              label="Token"
              labelWidth={10}
              inputWidth={20}
              onReset={this.onResetToken}
              onChange={onUpdateDatasourceSecureJsonDataOption(this.props, 'token')}
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel className="width-10">Default Bucket</InlineFormLabel>
            <div className="width-10">
              <Input
                className="width-20"
                placeholder="default bucket"
                value={options.jsonData.defaultBucket || ''}
                onChange={onUpdateDatasourceJsonDataOption(this.props, 'defaultBucket')}
              />
            </div>
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
                className="width-10"
                placeholder="10s"
                value={options.jsonData.timeInterval || ''}
                onChange={onUpdateDatasourceJsonDataOption(this.props, 'timeInterval')}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderInflux1x() {
    const { options, onOptionsChange } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as InfluxSecureJsonData;

    return (
      <div>
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
              <InlineFormLabel className="width-10">Database</InlineFormLabel>
              <div className="width-20">
                <Input
                  className="width-20"
                  value={options.database || ''}
                  onChange={onUpdateDatasourceOption(this.props, 'database')}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-10">User</InlineFormLabel>
              <div className="width-10">
                <Input
                  className="width-20"
                  value={options.user || ''}
                  onChange={onUpdateDatasourceOption(this.props, 'user')}
                />
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
                onChange={onUpdateDatasourceSecureJsonDataOption(this.props, 'password')}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel
                className="width-10"
                tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
          will restrict you and return an error if the query is too large."
              >
                HTTP Method
              </InlineFormLabel>
              <Select
                className="width-10"
                value={httpModes.find(httpMode => httpMode.value === options.jsonData.httpMode)}
                options={httpModes}
                defaultValue={options.jsonData.httpMode}
                onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'httpMode')}
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
              <InlineFormLabel
                className="width-10"
                tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
              >
                Min time interval
              </InlineFormLabel>
              <div className="width-10">
                <Input
                  className="width-10"
                  placeholder="10s"
                  value={options.jsonData.timeInterval || ''}
                  onChange={onUpdateDatasourceJsonDataOption(this.props, 'timeInterval')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { options } = this.props;

    return (
      <>
        <h3 className="page-heading">Query Language</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <Select
                className="width-30"
                value={options.jsonData.version === InfluxVersion.Flux ? versions[1] : versions[0]}
                options={versions}
                defaultValue={versions[0]}
                onChange={this.onVersionChanged}
              />
            </div>
          </div>
        </div>

        {options.jsonData.version === InfluxVersion.Flux ? this.renderInflux2x() : this.renderInflux1x()}
      </>
    );
  }
}

export default ConfigEditor;
