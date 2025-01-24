import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigSection } from '@grafana/plugin-ui';
import { Field, Switch } from '@grafana/ui';

export interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

export interface SecureSocksProxyConfig extends DataSourceJsonData {
  enableSecureSocksProxy?: boolean;
}

export function SecureSocksProxySettingsNewStyling<T extends SecureSocksProxyConfig>({
  options,
  onOptionsChange,
}: Props<T>): JSX.Element {
  return (
    <ConfigSection title="Secure Socks Proxy">
      <Field label="Enabled" description="Connect to this datasource via the secure socks proxy.">
        <Switch
          value={options.jsonData.enableSecureSocksProxy ?? false}
          onChange={(event) =>
            onOptionsChange({
              ...options,
              jsonData: { ...options.jsonData, enableSecureSocksProxy: event.currentTarget.checked },
            })
          }
        />
      </Field>
    </ConfigSection>
  );
}
