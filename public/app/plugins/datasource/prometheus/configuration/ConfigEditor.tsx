import { css } from '@emotion/css';

import { type DataSourcePluginOptionsEditorProps, type GrafanaTheme2 } from '@grafana/data';
import { AdvancedHttpSettings, ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { AlertingSettingsOverhaul, type PromOptions, PromSettings } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import { Alert, useTheme2 } from '@grafana/ui';

import { HttpSettings } from './HttpSettings';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Prometheus data source is no longer available. Switch to server access mode.
        </Alert>
      )}
      <DataSourceDescription
        dataSourceName="Prometheus"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/prometheus/configure/"
      />
      <hr className={`${styles.hrTopSpace} ${styles.hrBottomSpace}`} />
      <HttpSettings
        options={options}
        onOptionsChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />
      <hr />
      <ConfigSection
        className={styles.advancedSettings}
        title="Advanced settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
      >
        <AdvancedHttpSettings
          className={styles.advancedHTTPSettingsMargin}
          config={options}
          onChange={onOptionsChange}
        />
        <AlertingSettingsOverhaul<PromOptions> options={options} onOptionsChange={onOptionsChange} />
        <PromSettings options={options} onOptionsChange={onOptionsChange} />
      </ConfigSection>
    </>
  );
};

export function overhaulStyles(theme: GrafanaTheme2) {
  return {
    additionalSettings: css({
      marginBottom: '25px',
    }),
    secondaryGrey: css({
      color: `${theme.colors.secondary.text}`,
      opacity: '65%',
    }),
    inlineError: css({
      margin: '0px 0px 4px 245px',
    }),
    switchField: css({
      alignItems: 'center',
    }),
    sectionHeaderPadding: css({
      paddingTop: '32px',
    }),
    sectionBottomPadding: css({
      paddingBottom: '28px',
    }),
    subsectionText: css({
      fontSize: '12px',
    }),
    hrBottomSpace: css({
      marginBottom: '56px',
    }),
    hrTopSpace: css({
      marginTop: '50px',
    }),
    textUnderline: css({
      textDecoration: 'underline',
    }),
    versionMargin: css({
      marginBottom: '12px',
    }),
    advancedHTTPSettingsMargin: css({
      margin: '24px 0 8px 0',
    }),
    advancedSettings: css({
      paddingTop: '32px',
    }),
    alertingTop: css({
      marginTop: '40px !important',
    }),
    overhaulPageHeading: css({
      fontWeight: '400',
    }),
    container: css({
      maxwidth: '578',
    }),
  };
}
