import { cx } from '@emotion/css';
import React from 'react';

import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { InlineField, Switch, useTheme2 } from '@grafana/ui';

import { docsTip, overhaulStyles } from './ConfigEditor';

export interface Props<T extends DataSourceJsonData>
  extends Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> {}

export interface AlertingConfig extends DataSourceJsonData {
  manageAlerts?: boolean;
}

export function AlertingSettingsOverhaul<T extends AlertingConfig>({
  options,
  onOptionsChange,
}: Props<T>): JSX.Element {
  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  const prometheusConfigOverhaulAuth = config.featureToggles.prometheusConfigOverhaulAuth;

  return (
    <ConfigSubSection
      title="Alerting"
      className={cx(styles.container, { [styles.alertingTop]: prometheusConfigOverhaulAuth })}
    >
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
    </ConfigSubSection>
  );
}
