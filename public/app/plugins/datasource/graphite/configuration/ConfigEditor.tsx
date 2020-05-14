import React, { PureComponent } from 'react';
import { DataSourceHttpSettings, InlineFormLabel, LegacyForms } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceJsonDataOptionChecked,
} from '@grafana/data';
import { GraphiteOptions, GraphiteType } from '../types';

const graphiteVersions = [
  { label: '0.9.x', value: '0.9' },
  { label: '1.0.x', value: '1.0' },
  { label: '1.1.x', value: '1.1' },
];

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
        <a href="https://github.com/grafana/metrictank" className="pointer" target="_blank">
          Metrictank
        </a>{' '}
        then select that here. This will enable Metrictank specific features like query processing meta data. Metrictank
        is a multi-tenant timeseries engine for Graphite and friends.
      </p>
    );
  };

  render() {
    const { options, onOptionsChange } = this.props;

    const currentVersion =
      graphiteVersions.find(item => item.value === options.jsonData.graphiteVersion) ?? graphiteVersions[2];

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
                value={graphiteTypes.find(type => type.value === options.jsonData.graphiteType)}
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
                  checked={options.jsonData.rollupIndicatorEnabled}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(this.props, 'rollupIndicatorEnabled')}
                />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
}
