// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/AlertingSettingsOverhaul.tsx
import { cx } from '@emotion/css';

import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { InlineField, Switch, useTheme2 } from '@grafana/ui';

import { docsTip, overhaulStyles } from './ConfigEditor';

interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

interface AlertingConfig extends DataSourceJsonData {
  manageAlerts?: boolean;
}

export function AlertingSettingsOverhaul<T extends AlertingConfig>({
  options,
  onOptionsChange,
}: Props<T>): JSX.Element {
  const theme = useTheme2();
  // imported GrafanaTheme2 from @grafana/data does not match type of same from @grafana/ui
  // @ts-ignore
  const styles = overhaulStyles(theme);

  return (
    <ConfigSubSection title="Alerting" className={cx(styles.container, styles.alertingTop)}>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              labelWidth={30}
              label="Manage alerts via Alerting UI"
              disabled={options.readOnly}
              tooltip={
                <>
                  Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data
                  source. {docsTip()}
                </>
              }
              interactive={true}
              className={styles.switchField}
            >
              <Switch
                value={options.jsonData.manageAlerts ?? config.defaultDatasourceManageAlertsUiToggle}
                onChange={(event) =>
                  onOptionsChange({
                    ...options,
                    jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
                  })
                }
                id={selectors.components.DataSource.Prometheus.configPage.manageAlerts}
              />
            </InlineField>
          </div>
        </div>
      </div>
    </ConfigSubSection>
  );
}
