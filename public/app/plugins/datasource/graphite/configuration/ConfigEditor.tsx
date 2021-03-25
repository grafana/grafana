import React, { PureComponent } from 'react';
import { DataSourceHttpSettings, InlineFormLabel, LegacyForms } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import {
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceJsonDataOptionChecked,
} from '@grafana/data';
import { GraphiteOptions, GraphiteType } from '../types';
import { DEFAULT_GRAPHITE_VERSION, GRAPHITE_VERSIONS } from '../versions';

const graphiteVersions = GRAPHITE_VERSIONS.map((version) => ({ label: `${version}.x`, value: version }));

const graphiteTypes = Object.entries(GraphiteType).map(([label, value]) => ({
  label,
  value,
}));

export type Props = DataSourcePluginOptionsEditorProps<GraphiteOptions>;

export class ConfigEditor extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  renderTypeHelp = () => {
    return (
      <p>
        There are different types of Graphite compatible backends. Here you can specify the type you are using. If you
        are using{' '}
        <a href="https://github.com/grafana/metrictank" className="pointer" target="_blank" rel="noreferrer">
          Metrictank
        </a>{' '}
        then select that here. This will enable Metrictank specific features like query processing meta data. Metrictank
        is a multi-tenant timeseries engine for Graphite and friends.
      </p>
    );
  };

  componentDidMount() {
    updateDatasourcePluginJsonDataOption(this.props, 'graphiteVersion', this.currentGraphiteVersion);
  }

  render() {
    const { options, onOptionsChange } = this.props;

    const currentVersion = graphiteVersions.find((item) => item.value === this.currentGraphiteVersion);

    return (
      <>
        <DataSourceHttpSettings
          defaultUrl="http://localhost:8080"
          dataSourceConfig={options}
          onChange={onOptionsChange}
        />
        <h3 className="page-heading">Graphite details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel tooltip="This option controls what functions are available in the Graphite query editor.">
                Version
              </InlineFormLabel>
              <Select
                value={currentVersion}
                options={graphiteVersions}
                width={8}
                onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteVersion')}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel tooltip={this.renderTypeHelp}>Type</InlineFormLabel>
              <Select
                options={graphiteTypes}
                value={graphiteTypes.find((type) => type.value === options.jsonData.graphiteType)}
                width={8}
                onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteType')}
              />
            </div>
          </div>
          {options.jsonData.graphiteType === GraphiteType.Metrictank && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <Switch
                  label="Rollup indicator"
                  labelClass={'width-10'}
                  tooltip="Shows up as an info icon in panel headers when data is aggregated"
                  checked={!!options.jsonData.rollupIndicatorEnabled}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(this.props, 'rollupIndicatorEnabled')}
                />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  private get currentGraphiteVersion() {
    return this.props.options.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;
  }
}
