import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineSwitch, Input, Badge, useStyles2 } from '@grafana/ui';

export interface Props {
  dataSourceName: string;
  isDefault: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (value: boolean) => void;
  alertingSupported: boolean;
}

export function BasicSettings({ dataSourceName, isDefault, onDefaultChange, onNameChange, alertingSupported }: Props) {
  return (
    <>
      {<AlertingEnabled enabled={alertingSupported} />}
      <div className="gf-form-group" aria-label="Datasource settings page basic settings">
        <div className="gf-form-inline">
          {/* Name */}
          <div className="gf-form max-width-30">
            <InlineField
              label="Name"
              tooltip="The name is used when you select the data source in panels. The default data source is
              'preselected in new panels."
              grow
            >
              <Input
                id="basic-settings-name"
                type="text"
                value={dataSourceName}
                placeholder="Name"
                onChange={(event) => onNameChange(event.currentTarget.value)}
                required
                aria-label={selectors.pages.DataSource.name}
              />
            </InlineField>
          </div>

          {/* Is Default */}
          <InlineField label="Default" labelWidth={8}>
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
        <Badge color="green" icon="check-circle" text="Alerting supported" />
      ) : (
        <Badge color="orange" icon="exclamation-triangle" text="Alerting not supported" />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
