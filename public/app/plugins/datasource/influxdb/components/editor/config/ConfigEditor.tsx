import { uniqueId } from 'lodash';
import React, { PureComponent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data/src';
import { Alert, DataSourceHttpSettings, InlineField, LegacyForms, Select } from '@grafana/ui/src';
import { config } from 'app/core/config';

import { BROWSER_MODE_DISABLED_MESSAGE } from '../../../constants';
import { InfluxOptions, InfluxVersion } from '../../../types';

import { InfluxFluxConfig } from './InfluxFluxConfig';
import { InfluxInfluxQLConfig } from './InfluxInfluxQLConfig';
import { InfluxSqlConfig } from './InfluxSQLConfig';

const { Input } = LegacyForms;

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
  {
    label: 'SQL',
    value: InfluxVersion.SQL,
    description: 'Native SQL language.  Supported in InfluxDB 3.0',
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

  getQueryLanguageDropdownValue = (v?: InfluxVersion) => {
    switch (v) {
      case InfluxVersion.InfluxQL:
        return versions[0];
      case InfluxVersion.Flux:
        return versions[1];
      case InfluxVersion.SQL:
        return versions[2];
      default:
        return versions[0];
    }
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

  renderJsonDataOptions() {
    switch (this.props.options.jsonData.version) {
      case InfluxVersion.InfluxQL:
        return <InfluxInfluxQLConfig {...this.props} />;
      case InfluxVersion.Flux:
        return <InfluxFluxConfig {...this.props} />;
      case InfluxVersion.SQL:
        return <InfluxSqlConfig {...this.props} />;
      default:
        return null;
    }
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
                value={this.getQueryLanguageDropdownValue(options.jsonData.version)}
                options={versions}
                defaultValue={versions[0]}
                onChange={this.onVersionChanged}
              />
            </div>
          </div>
        </div>

        {options.jsonData.version === InfluxVersion.Flux && (
          <Alert severity="info" title="Support for Flux in Grafana is currently in beta<">
            <p>
              Please report any issues to: <br />
              <a href="https://github.com/grafana/grafana/issues/new/choose">
                https://github.com/grafana/grafana/issues
              </a>
            </p>
          </Alert>
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
          {this.renderJsonDataOptions()}
          <div className="gf-form-inline">
            <InlineField
              labelWidth={20}
              label="Max series"
              tooltip="Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000."
            >
              <Input
                placeholder="1000"
                type="number"
                className="width-20"
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
