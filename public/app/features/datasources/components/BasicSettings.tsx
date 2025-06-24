import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { InlineField, InlineSwitch, Input, Badge, useStyles2 } from '@grafana/ui';

export interface Props {
  dataSourceName: string;
  isDefault: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BasicSettings({ dataSourceName, isDefault, onDefaultChange, onNameChange, disabled }: Props) {
  return (
    <>
      <div
        className="gf-form-group"
        aria-label={t(
          'datasources.basic-settings.aria-label-datasource-settings-page-basic',
          'Datasource settings page basic settings'
        )}
      >
        <div className="gf-form-inline">
          {/* Name */}
          <div className="gf-form max-width-30">
            <InlineField
              label={t('datasources.basic-settings.label-name', 'Name')}
              tooltip={t(
                'datasources.basic-serttings.tooltip-name',
                'The name is used when you select the data source in panels. The default data source is preselected in new panels.'
              )}
              grow
              disabled={disabled}
              labelWidth={14}
            >
              <Input
                id="basic-settings-name"
                type="text"
                value={dataSourceName}
                placeholder={t('datasources.basic-settings.basic-settings-name-placeholder-name', 'Name')}
                onChange={(event) => onNameChange(event.currentTarget.value)}
                required
                data-testid={selectors.pages.DataSource.name}
              />
            </InlineField>
          </div>

          {/* Is Default */}
          <InlineField
            label={t('datasources.basic-settings.label-default', 'Default')}
            labelWidth={8}
            disabled={disabled}
          >
            <InlineSwitch
              id="basic-settings-default"
              value={isDefault}
              onChange={(event: React.FormEvent<HTMLInputElement>) => {
                onDefaultChange(event.currentTarget.checked);
              }}
            />
          </InlineField>
        </div>
      </div>
    </>
  );
}

export function AlertingEnabled({ enabled }: { enabled: boolean }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.badge}>
      {enabled ? (
        <Badge
          color="green"
          icon="check-circle"
          text={t('datasources.alerting-enabled.text-alerting-supported', 'Alerting supported')}
        />
      ) : (
        <Badge
          color="orange"
          icon="exclamation-triangle"
          text={t('datasources.alerting-enabled.text-alerting-not-supported', 'Alerting not supported')}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css({
    marginBottom: theme.spacing(2),
  }),
});
