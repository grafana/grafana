import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { InlineSwitch } from '../../components/Switch/Switch';
import { InlineField } from '../Forms/InlineField';

export interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

export interface AlertingConfig extends DataSourceJsonData {
  manageAlerts?: boolean;
}

export function AlertingSettings<T extends AlertingConfig>({ options, onOptionsChange }: Props<T>): JSX.Element {
  return (
    <>
      <h3 className="page-heading">
        <Trans i18nKey="grafana-ui.data-source-settings.alerting-settings-heading">Alerting</Trans>
      </h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              labelWidth={29}
              label={t('grafana-ui.data-source-settings.alerting-settings-label', 'Manage alert rules in Alerting UI')}
              disabled={options.readOnly}
              tooltip={t(
                'grafana-ui.data-source-settings.alerting-settings-tooltip',
                'Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data source.'
              )}
            >
              <InlineSwitch
                value={options.jsonData.manageAlerts !== false}
                onChange={(event) =>
                  onOptionsChange({
                    ...options,
                    jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
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
