import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import {
  ConfigSection,
  DataSourceDescription,
  ConnectionSettings,
  Auth,
  convertLegacyAuthProps,
  AdvancedHttpSettings,
} from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Divider, SecureSocksProxySettings, Stack } from '@grafana/ui';

import { LokiOptions } from '../types';

import { AlertingSettings } from './AlertingSettings';
import { DerivedFields } from './DerivedFields';
import { QuerySettings } from './QuerySettings';

export type Props = DataSourcePluginOptionsEditorProps<LokiOptions>;

const makeJsonUpdater =
  <T,>(field: keyof LokiOptions) =>
  (options: DataSourceSettings<LokiOptions>, value: T): DataSourceSettings<LokiOptions> => {
    return {
      ...options,
      jsonData: {
        ...options.jsonData,
        [field]: value,
      },
    };
  };

const setMaxLines = makeJsonUpdater('maxLines');
const setDerivedFields = makeJsonUpdater('derivedFields');

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  return (
    <>
      <DataSourceDescription
        dataSourceName="Loki"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/loki/configure-loki-data-source/"
        hasRequiredFields={false}
      />
      <Divider spacing={4} />
      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:3100" />
      <Divider spacing={4} />
      <Auth
        {...convertLegacyAuthProps({
          config: options,
          onChange: onOptionsChange,
        })}
      />
      <Divider spacing={4} />
      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen
      >
        <Stack gap={5} direction="column">
          <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
          {config.secureSocksDSProxyEnabled && (
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          )}
          <AlertingSettings options={options} onOptionsChange={onOptionsChange} />
          <QuerySettings
            maxLines={options.jsonData.maxLines || ''}
            onMaxLinedChange={(value) => onOptionsChange(setMaxLines(options, value))}
          />
          <DerivedFields
            fields={options.jsonData.derivedFields}
            onChange={(value) => onOptionsChange(setDerivedFields(options, value))}
          />
        </Stack>
      </ConfigSection>
    </>
  );
};
