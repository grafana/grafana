import { uniqueId } from 'lodash';
import React, { PureComponent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data/src';
import {
  Alert,
  DataSourceHttpSettings,
  InfoBox,
  InlineField,
  InlineFormLabel,
  LegacyForms,
  Select,
} from '@grafana/ui/src';
import { config } from 'app/core/config';

import { BROWSER_MODE_DISABLED_MESSAGE } from '../../../constants';
import { InfluxOptions, InfluxSecureJsonData, InfluxVersion } from '../../../types';

const { Input, SecretFormField } = LegacyForms;

const httpModes: SelectableValue[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
];

const versions: Array<SelectableValue<InfluxVersion>> = [
  {
    label: 'InfluxQL',
    value: InfluxVersion.InfluxQL,
    description: 'The InfluxDB SQL-like query language.',
  },
  {
    label: 'Flux',
    value: InfluxVersion.Flux,
    description: 'Advanced data scripting and query language.  Supported in InfluxDB 2.x and 1.8+',
  },
];

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;
type State = {
  maxSeries: string | undefined;
};

export class ConfigEditor extends PureComponent<Props, State> {
  state = {
    maxSeries: '',
  };

  htmlPrefix: string;

  constructor(props: Props) {
    super(props);
    this.state.maxSeries = props.options.jsonData.maxSeries?.toString() || '';
    this.htmlPrefix = uniqueId('influxdb-config');
  }

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

  renderInflux2x() {
    const { options } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as InfluxSecureJsonData;
    const { htmlPrefix } = this;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel htmlFor={`${htmlPrefix}-org`} className="width-10">
              Organization
            </InlineFormLabel>
            <div className="width-10">
              <Input
                id={`${htmlPrefix}-org`}
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
              isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
              value={secureJsonData.token || ''}
              label="Token"
              aria-label="Token"
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
      </>
    );
  }

  renderInflux1x() {
    const { options } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as InfluxSecureJsonData;
    const { htmlPrefix } = this;

    return (
      <>
        <InfoBox>
          <h5>Database Access</h5>
          <p>
            Setting the database for this datasource does not deny access to other databases. The InfluxDB query syntax
            allows switching the database in the query. For example:
            <code>SHOW MEASUREMENTS ON _internal</code> or
            <code>SELECT * FROM &quot;_internal&quot;..&quot;database&quot; LIMIT 10</code>
            <br />
            <br />
            To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.
          </p>
        </InfoBox>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel htmlFor={`${htmlPrefix}-db`} className="width-10">
              Database
            </InlineFormLabel>
            <div className="width-20">
              <Input
                id={`${htmlPrefix}-db`}
                className="width-20"
                value={options.jsonData.dbName ?? options.database}
                onChange={(event) => {
                  this.props.onOptionsChange({
                    ...options,
                    database: '',
                    jsonData: {
                      ...options.jsonData,
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
                onChange={onUpdateDatasourceOption(this.props, 'user')}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField
              isConfigured={Boolean(secureJsonFields && secureJsonFields.password)}
              value={secureJsonData.password || ''}
              label="Password"
              aria-label="Password"
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
              className="width-10"
              value={httpModes.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
              options={httpModes}
              defaultValue={options.jsonData.httpMode}
              onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'httpMode')}
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
                className="width-10"
                placeholder="10s"
                value={options.jsonData.timeInterval || ''}
                onChange={onUpdateDatasourceJsonDataOption(this.props, 'timeInterval')}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  render() {
    const { options, onOptionsChange } = this.props;
    const isDirectAccess = options.access === 'direct';

    return (
      <>
        <h3 className="page-heading">Query Language</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <Select
                aria-label="Query language"
                className="width-30"
                value={options.jsonData.version === InfluxVersion.Flux ? versions[1] : versions[0]}
                options={versions}
                defaultValue={versions[0]}
                onChange={this.onVersionChanged}
              />
            </div>
          </div>
        </div>

        {options.jsonData.version === InfluxVersion.Flux && (
          <InfoBox>
            <h5>Support for Flux in Grafana is currently in beta</h5>
            <p>
              Please report any issues to: <br />
              <a href="https://github.com/grafana/grafana/issues/new/choose">
                https://github.com/grafana/grafana/issues
              </a>
            </p>
          </InfoBox>
        )}

        {isDirectAccess && (
          <Alert title="Error" severity="error">
            {BROWSER_MODE_DISABLED_MESSAGE}
          </Alert>
        )}

        <DataSourceHttpSettings
          showAccessOptions={isDirectAccess}
          dataSourceConfig={options}
          defaultUrl="http://localhost:8086"
          onChange={onOptionsChange}
          secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
        />

        <div className="gf-form-group">
          <div>
            <h3 className="page-heading">InfluxDB Details</h3>
          </div>
          {options.jsonData.version === InfluxVersion.Flux ? this.renderInflux2x() : this.renderInflux1x()}
          <div className="gf-form-inline">
            <InlineField
              labelWidth={20}
              label="Max series"
              tooltip="Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000."
            >
              <Input
                placeholder="1000"
                type="number"
                className="width-10"
                value={this.state.maxSeries}
                onChange={(event) => {
                  // We duplicate this state so that we allow to write freely inside the input. We don't have
                  // any influence over saving so this seems to be only way to do this.
                  this.setState({ maxSeries: event.currentTarget.value });
                  const val = parseInt(event.currentTarget.value, 10);
                  updateDatasourcePluginJsonDataOption(this.props, 'maxSeries', Number.isFinite(val) ? val : undefined);
                }}
              />
            </InlineField>
          </div>
        </div>
      </>
    );
  }
}

export default ConfigEditor;
