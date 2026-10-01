import { useEffect, useState } from 'react';

import {
  type DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceJsonDataOptionChecked,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, DataSourceHttpSettings, Field, FieldSet, Select, Switch } from '@grafana/ui';

import { type GraphiteOptions, GraphiteType } from '../types';
import { DEFAULT_GRAPHITE_VERSION, GRAPHITE_VERSIONS } from '../versions';

import { MappingsConfiguration } from './MappingsConfiguration';
import { fromString, toString } from './parseLokiLabelMappings';

const SHOW_MAPPINGS_HELP_KEY = 'grafana.datasources.graphite.config.showMappingsHelp';

const graphiteVersions = GRAPHITE_VERSIONS.map((version) => ({ label: `${version}.x`, value: version }));

const graphiteTypes = Object.entries(GraphiteType).map(([label, value]) => ({
  label,
  value,
}));

export type Props = DataSourcePluginOptionsEditorProps<GraphiteOptions>;

export function ConfigEditor(props: Props) {
  const { options, onOptionsChange } = props;
  const [showMappingsHelp, setShowMappingsHelp] = useState(() => store.getObject(SHOW_MAPPINGS_HELP_KEY, true));

  const currentGraphiteVersion = options.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;

  // Persist the default so the rest of the app can rely on a version being set. Only written when
  // absent, so the resulting options change does not retrigger this.
  useEffect(() => {
    if (!options.jsonData.graphiteVersion) {
      updateDatasourcePluginJsonDataOption({ options, onOptionsChange }, 'graphiteVersion', DEFAULT_GRAPHITE_VERSION);
    }
  }, [options, onOptionsChange]);

  const currentVersion = graphiteVersions.find((item) => item.value === currentGraphiteVersion);

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
            onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'graphiteVersion')}
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
            onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'graphiteType')}
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
              onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'rollupIndicatorEnabled')}
            />
          </Field>
        )}
      </FieldSet>
      <MappingsConfiguration
        mappings={(options.jsonData.importConfiguration?.loki?.mappings || []).map(toString)}
        showHelp={showMappingsHelp}
        onDismiss={() => {
          setShowMappingsHelp(false);
          store.setObject(SHOW_MAPPINGS_HELP_KEY, false);
        }}
        onRestoreHelp={() => {
          setShowMappingsHelp(true);
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
