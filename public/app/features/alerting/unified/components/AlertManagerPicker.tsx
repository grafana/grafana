import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { InlineField, Select, useStyles2 } from '@grafana/ui';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface Props {
  disabled?: boolean;
  /**
   * If true, only show alertmanagers that are receiving alerts from Grafana
   */
  showOnlyReceivingGrafanaAlerts?: boolean;
}

function getAlertManagerLabel(alertManager: AlertManagerDataSource) {
  return alertManager.name === GRAFANA_RULES_SOURCE_NAME ? 'Grafana' : alertManager.name.slice(0, 37);
}

export const AlertManagerPicker = ({ disabled = false, showOnlyReceivingGrafanaAlerts }: Props) => {
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager, availableAlertManagers, setSelectedAlertmanager } = useAlertmanager();

  const options: Array<SelectableValue<string>> = useMemo(() => {
    return availableAlertManagers
      .filter(({ name, handleGrafanaManagedAlerts }) => {
        const isReceivingGrafanaAlerts = name === GRAFANA_RULES_SOURCE_NAME || handleGrafanaManagedAlerts;
        return showOnlyReceivingGrafanaAlerts ? isReceivingGrafanaAlerts : true;
      })
      .map((ds) => ({
        label: getAlertManagerLabel(ds),
        value: ds.name,
        imgUrl: ds.imgUrl,
        meta: ds.meta,
      }));
  }, [availableAlertManagers, showOnlyReceivingGrafanaAlerts]);

  return (
    <InlineField
      className={styles.field}
      label={disabled ? 'Alertmanager' : 'Choose Alertmanager'}
      disabled={disabled || options.length === 1}
      data-testid="alertmanager-picker"
    >
      <Select
        aria-label={disabled ? 'Alertmanager' : 'Choose Alertmanager'}
        width={29}
        className="ds-picker select-container"
        backspaceRemovesValue={false}
        onChange={(value) => {
          if (value?.value) {
            setSelectedAlertmanager(value.value);
          }
        }}
        options={options}
        maxMenuHeight={500}
        noOptionsMessage="No datasources found"
        value={selectedAlertmanager}
        getOptionLabel={(o) => o.label}
      />
    </InlineField>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  field: css({
    margin: 0,
  }),
});
