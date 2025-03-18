import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';

import { InlineSwitch } from '../../components/Switch/Switch';
import { Trans } from '../../utils/i18n';
import { InlineField } from '../Forms/InlineField';

export interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

export interface SecureSocksProxyConfig extends DataSourceJsonData {
  enableSecureSocksProxy?: boolean;
}

export function SecureSocksProxySettings<T extends SecureSocksProxyConfig>({
  options,
  onOptionsChange,
}: Props<T>): JSX.Element {
  return (
    <>
      <h3 className="page-heading">
        <Trans i18nKey="grafana-ui.data-source-settings.secure-socks-heading">Secure Socks Proxy</Trans>
      </h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              labelWidth={26}
              label="Enabled"
              tooltip="Connect to this datasource via the secure socks proxy."
            >
              <InlineSwitch
                value={options.jsonData.enableSecureSocksProxy ?? false}
                onChange={(event) =>
                  onOptionsChange({
                    ...options,
                    jsonData: { ...options.jsonData, enableSecureSocksProxy: event!.currentTarget.checked },
                  })
                }
              />
            </InlineField>
          </div>
        </div>
      </div>
    </>
  );
}
