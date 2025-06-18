// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/AlertingSettingsOverhaul.tsx
import { cx } from '@emotion/css';

import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { InlineField, Switch, useTheme2 } from '@grafana/ui';

import { docsTip, overhaulStyles } from './shared/utils';

interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

interface AlertingConfig extends DataSourceJsonData {
  manageAlerts?: boolean;
  allowAsRecordingRulesTarget?: boolean;
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
    <ConfigSubSection
      title={t('grafana-prometheus.configuration.alerting-settings-overhaul.title-alerting', 'Alerting')}
      className={cx(styles.container, styles.alertingTop)}
    >
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              labelWidth={30}
              label={t(
                'grafana-prometheus.configuration.alerting-settings-overhaul.label-manage-alerts-via-alerting-ui',
                'Manage alerts via Alerting UI'
              )}
              disabled={options.readOnly}
              tooltip={
                <>
                  <Trans i18nKey="grafana-prometheus.configuration.alerting-settings-overhaul.tooltip-manage-alerts-via-alerting-ui">
                    Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager
                    data source.
                  </Trans>{' '}
                  {docsTip()}
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
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              labelWidth={30}
              label={t(
                'grafana-prometheus.configuration.alerting-settings-overhaul.label-allow-as-recording-rules-target',
                'Allow as recording rules target'
              )}
              disabled={options.readOnly}
              tooltip={
                <>
                  <Trans i18nKey="grafana-prometheus.configuration.alerting-settings-overhaul.tooltip-allow-as-recording-rules-target">
                    Allow this data source to be selected as a target for writing recording rules.
                  </Trans>{' '}
                  {docsTip()}
                </>
              }
              interactive={true}
              className={styles.switchField}
            >
              <Switch
                value={
                  options.jsonData.allowAsRecordingRulesTarget ?? config.defaultAllowRecordingRulesTargetAlertsUiToggle
                }
                onChange={(event) =>
                  onOptionsChange({
                    ...options,
                    jsonData: { ...options.jsonData, allowAsRecordingRulesTarget: event!.currentTarget.checked },
                  })
                }
                id={selectors.components.DataSource.Prometheus.configPage.allowAsRecordingRulesTarget}
              />
            </InlineField>
          </div>
        </div>
      </div>
    </ConfigSubSection>
  );
}
