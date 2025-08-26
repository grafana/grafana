import { css } from '@emotion/css';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  ConfigSection,
  ConnectionSettings,
  DataSourceDescription,
  convertLegacyAuthProps,
} from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Divider, SecureSocksProxySettings, Stack, useStyles2 } from '@grafana/ui';

import { ParcaDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<ParcaDataSourceOptions> {}

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <DataSourceDescription
        dataSourceName="Parca"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/parca"
        hasRequiredFields={false}
      />

      <Divider spacing={4} />

      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:7070" />

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
        <Stack gap={5} direction="column">
          <AdvancedHttpSettings config={options} onChange={onOptionsChange} />

          {config.secureSocksDSProxyEnabled && (
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          )}
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
