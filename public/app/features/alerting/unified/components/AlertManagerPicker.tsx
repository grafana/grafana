import { css } from '@emotion/css';
import { ComponentProps, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { InlineField, Select, SelectMenuOptions, useStyles2 } from '@grafana/ui';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface Props {
  disabled?: boolean;
}

function getAlertManagerLabel(alertManager: AlertManagerDataSource) {
  return alertManager.name === GRAFANA_RULES_SOURCE_NAME ? 'Grafana' : alertManager.name;
}

export const AlertManagerPicker = ({ disabled = false }: Props) => {
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager, availableAlertManagers, setSelectedAlertmanager } = useAlertmanager();

  const options = useMemo(() => {
    return availableAlertManagers.map<SelectableValue<string>>((ds) => ({
      label: getAlertManagerLabel(ds),
      value: ds.name,
      imgUrl: ds.imgUrl,
      meta: ds.meta,
    }));
  }, [availableAlertManagers]);

  const isDisabled = disabled || options.length === 1;
  const label = isDisabled ? 'Alertmanager' : 'Choose Alertmanager';

  return (
    <InlineField className={styles.field} label={label} disabled={isDisabled} data-testid="alertmanager-picker">
      <Select
        aria-label={label}
        width={29}
        className="ds-picker select-container"
        backspaceRemovesValue={false}
        onChange={(value) => {
          if (value?.value) {
            setSelectedAlertmanager(value.value);
          }
        }}
        options={options}
        noOptionsMessage="No datasources found"
        value={selectedAlertmanager}
        getOptionLabel={(o) => o.label}
        components={{ Option: CustomOption }}
      />
    </InlineField>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  field: css({
    margin: 0,
  }),
});

// custom option that overwrites the default "white-space: nowrap" for Alertmanager names that are really long
const CustomOption = (props: ComponentProps<typeof SelectMenuOptions>) => (
  <SelectMenuOptions
    {...props}
    renderOptionLabel={({ label }) => <div style={{ whiteSpace: 'pre-line' }}>{label}</div>}
  />
);
