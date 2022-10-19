import React, { PureComponent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceJsonDataOptionChecked,
} from '@grafana/data';
import { Alert, DataSourceHttpSettings, InlineFormLabel, LegacyForms, Select } from '@grafana/ui';
import store from 'app/core/store';

import { GraphiteOptions, GraphiteType } from '../types';
import { DEFAULT_GRAPHITE_VERSION, GRAPHITE_VERSIONS } from '../versions';

import { MappingsConfiguration } from './MappingsConfiguration';
import { fromString, toString } from './parseLokiLabelMappings';

const { Switch } = LegacyForms;
export const SHOW_MAPPINGS_HELP_KEY = 'grafana.datasources.graphite.config.showMappingsHelp';

const graphiteVersions = GRAPHITE_VERSIONS.map((version) => ({ label: `${version}.x`, value: version }));

const graphiteTypes = Object.entries(GraphiteType).map(([label, value]) => ({
  label,
  value,
}));

export type Props = DataSourcePluginOptionsEditorProps<GraphiteOptions>;

type State = {
  showMappingsHelp: boolean;
};

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showMappingsHelp: store.getObject(SHOW_MAPPINGS_HELP_KEY, true),
    };
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
        {options.access === 'direct' && (
          <Alert title="Deprecation Notice" severity="warning">
            This data source uses browser access mode. This mode is deprecated and will be removed in the future. Please
            use server access mode instead.
          </Alert>
        )}
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
                aria-label="Graphite version"
                value={currentVersion}
                options={graphiteVersions}
                className="width-8"
                onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteVersion')}
              />
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel tooltip={this.renderTypeHelp}>Type</InlineFormLabel>
              <Select
                aria-label="Graphite backend type"
                options={graphiteTypes}
                value={graphiteTypes.find((type) => type.value === options.jsonData.graphiteType)}
                className="width-8"
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
        <MappingsConfiguration
          mappings={(options.jsonData.importConfiguration?.loki?.mappings || []).map(toString)}
          showHelp={this.state.showMappingsHelp}
          onDismiss={() => {
            this.setState({ showMappingsHelp: false });
            store.setObject(SHOW_MAPPINGS_HELP_KEY, false);
          }}
          onRestoreHelp={() => {
            this.setState({ showMappingsHelp: true });
            store.setObject(SHOW_MAPPINGS_HELP_KEY, true);
          }}
          onChange={(mappings) => {
            onOptionsChange({
              ...options,
              jsonData: {
                ...options.jsonData,
                importConfiguration: {
                  ...options.jsonData.importConfiguration,
                  loki: {
                    mappings: mappings.map(fromString),
                  },
                },
              },
            });
          }}
        />
      </>
    );
  }

  private get currentGraphiteVersion() {
    return this.props.options.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;
  }
}
