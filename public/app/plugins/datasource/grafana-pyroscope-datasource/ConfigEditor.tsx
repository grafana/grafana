import { css } from '@emotion/css';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  ConfigSection,
  ConfigSubSection,
  ConnectionSettings,
  DataSourceDescription,
  convertLegacyAuthProps,
} from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Divider, Field, Input, SecureSocksProxySettings, Stack, useStyles2 } from '@grafana/ui';

import { PyroscopeDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<PyroscopeDataSourceOptions> {}

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <DataSourceDescription
        dataSourceName="Pyroscope"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/pyroscope"
        hasRequiredFields={false}
      />

      <Divider spacing={4} />

      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:4040" />

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
        isInitiallyOpen={false}
      >
        <Stack gap={5} direction="column" maxWidth={72}>
          <AdvancedHttpSettings config={options} onChange={onOptionsChange} />

          {config.secureSocksDSProxyEnabled && (
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          )}

          <ConfigSubSection title="Querying">
            <Field
              noMargin
              label="Minimal step"
              htmlFor="minimal-step"
              description="Minimal step used for metric query. Should be the same or higher as the scrape interval setting in the Pyroscope database."
              error="Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s"
              invalid={!!options.jsonData.minStep && !/^\d+(ms|[Mwdhmsy])$/.test(options.jsonData.minStep)}
            >
              <Input
                id="minimal-step"
                value={options.jsonData.minStep}
                spellCheck={false}
                placeholder="15s"
                onChange={(event) => {
                  onOptionsChange({
                    ...options,
                    jsonData: {
                      ...options.jsonData,
                      minStep: event.currentTarget.value,
                    },
                  });
                }}
              />
            </Field>
          </ConfigSubSection>
        </Stack>
      </ConfigSection>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(2),
    maxWidth: '900px',
  }),
});
