import { PureComponent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceJsonDataOptionChecked,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, DataSourceHttpSettings, Field, FieldSet, Select, Switch } from '@grafana/ui';

import { GraphiteOptions, GraphiteType } from '../types';
import { DEFAULT_GRAPHITE_VERSION, GRAPHITE_VERSIONS } from '../versions';

import { MappingsConfiguration } from './MappingsConfiguration';
import { fromString, toString } from './parseLokiLabelMappings';

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
          secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
        />
        <FieldSet>
          <legend className="page-heading">Graphite details</legend>
          <Field
            label="Version"
            description="This option controls what functions are available in the Graphite query editor."
          >
            <Select
              id="graphite-version"
              aria-label="Graphite version"
              value={currentVersion}
              options={graphiteVersions}
              width={16}
              onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteVersion')}
            />
          </Field>

          <Field
            label="Graphite backend type"
            description="There are different types of Graphite compatible backends. Here you can specify the type you are using. For Metrictank, this will enable specific features, like query processing meta data. Metrictank
        is a multi-tenant timeseries engine for Graphite and friends."
          >
            <Select
              id="backend-type"
              options={graphiteTypes}
              value={graphiteTypes.find((type) => type.value === options.jsonData.graphiteType)}
              width={16}
              onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteType')}
            />
          </Field>
          {options.jsonData.graphiteType === GraphiteType.Metrictank && (
            <Field
              label="Rollup indicator"
              description="Shows up as an info icon in panel headers when data is aggregated."
            >
              <Switch
                id="rollup-indicator"
                value={!!options.jsonData.rollupIndicatorEnabled}
                onChange={onUpdateDatasourceJsonDataOptionChecked(this.props, 'rollupIndicatorEnabled')}
              />
            </Field>
          )}
        </FieldSet>
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
