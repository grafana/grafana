import { uniqueId } from 'lodash';
import { PureComponent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, DataSourceHttpSettings, InlineField, Select, Field, Input, FieldSet } from '@grafana/ui';

import { BROWSER_MODE_DISABLED_MESSAGE } from '../../../constants';
import { InfluxOptions, InfluxOptionsV1, InfluxVersion } from '../../../types';

import { InfluxFluxConfig } from './InfluxFluxConfig';
import { InfluxInfluxQLConfig } from './InfluxInfluxQLConfig';
import { InfluxSqlConfig } from './InfluxSQLConfig';
import { trackInfluxDBConfigV1QueryLanguageSelection } from './trackingv1';

const versionMap: Record<InfluxVersion, SelectableValue<InfluxVersion>> = {
  [InfluxVersion.InfluxQL]: {
    label: 'InfluxQL',
    value: InfluxVersion.InfluxQL,
    description: 'The InfluxDB SQL-like query language.',
  },
  [InfluxVersion.SQL]: {
    label: 'SQL',
    value: InfluxVersion.SQL,
    description: 'Native SQL language. Supported in InfluxDB 3.0',
  },
  [InfluxVersion.Flux]: {
    label: 'Flux',
    value: InfluxVersion.Flux,
    description: 'Supported in InfluxDB 2.x and 1.8+',
  },
};

const versions: Array<SelectableValue<InfluxVersion>> = [
  versionMap[InfluxVersion.InfluxQL],
  versionMap[InfluxVersion.SQL],
  versionMap[InfluxVersion.Flux],
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

  versionNotice = {
    Flux: 'Support for Flux in Grafana is currently in beta',
    SQL: 'Support for SQL in Grafana is currently in alpha',
  };

  onVersionChanged = (selected: SelectableValue<InfluxVersion>) => {
    const { options, onOptionsChange } = this.props;

    if (selected.value) {
      trackInfluxDBConfigV1QueryLanguageSelection({ version: selected.value });
    }

    const copy: DataSourceSettings<InfluxOptionsV1, {}> = {
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
      const { user, database, ...rest } = copy;

      onOptionsChange(rest as DataSourceSettings<InfluxOptions, {}>);
    } else {
      onOptionsChange(copy);
    }
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
        return <InfluxInfluxQLConfig {...this.props} />;
    }
  }

  render() {
    const { options, onOptionsChange } = this.props;
    const isDirectAccess = options.access === 'direct';

    return (
      <>
        <FieldSet>
          <h3 className="page-heading">Query language</h3>
          <Field>
            <Select
              aria-label="Query language"
              className="width-30"
              value={versionMap[options.jsonData.version ?? InfluxVersion.InfluxQL]}
              options={versions}
              defaultValue={versionMap[InfluxVersion.InfluxQL]}
              onChange={this.onVersionChanged}
            />
          </Field>
        </FieldSet>

        {options.jsonData.version !== InfluxVersion.InfluxQL && (
          <Alert severity="info" title={this.versionNotice[options.jsonData.version!]}>
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
        <FieldSet>
          <h3 className="page-heading">InfluxDB Details</h3>
          {this.renderJsonDataOptions()}
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
              onChange={(event: { currentTarget: { value: string } }) => {
                // We duplicate this state so that we allow to write freely inside the input. We don't have
                // any influence over saving so this seems to be only way to do this.
                this.setState({ maxSeries: event.currentTarget.value });
                const val = parseInt(event.currentTarget.value, 10);
                updateDatasourcePluginJsonDataOption(this.props, 'maxSeries', Number.isFinite(val) ? val : undefined);
              }}
            />
          </InlineField>
        </FieldSet>
      </>
    );
  }
}

export default ConfigEditor;
