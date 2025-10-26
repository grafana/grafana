import { css } from '@emotion/css';
import { ComponentProps, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineField, Select, SelectMenuOptions, useStyles2 } from '@grafana/ui';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { isExtraConfig } from '../utils/alertmanager/extraConfigs';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface Props {
  disabled?: boolean;
}

function getAlertManagerLabel(alertManager: AlertManagerDataSource) {
  if (alertManager.name === GRAFANA_RULES_SOURCE_NAME) {
    return 'Grafana';
  }

  return alertManager.displayName || alertManager.name;
}

export const AlertManagerPicker = ({ disabled = false }: Props) => {
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager, availableAlertManagers, setSelectedAlertmanager } = useAlertmanager();

  const options = useMemo(() => {
    // Group alertmanagers
    const grafanaAM = availableAlertManagers.find((am) => am.name === GRAFANA_RULES_SOURCE_NAME);
    const extraConfig = availableAlertManagers.find((am) => isExtraConfig(am.name));
    const datasourceAMs = availableAlertManagers.filter(
      (am) => am.name !== GRAFANA_RULES_SOURCE_NAME && !isExtraConfig(am.name)
    );

    const groupedOptions: Array<SelectableValue<string> | { label: string; options: Array<SelectableValue<string>> }> =
      [];

    // Add Grafana alertmanager first
    if (grafanaAM) {
      groupedOptions.push({
        label: getAlertManagerLabel(grafanaAM),
        value: grafanaAM.name,
        imgUrl: grafanaAM.imgUrl,
        meta: grafanaAM.meta,
      });
    }

    // Add extra config (single merged configuration)
    if (extraConfig) {
      groupedOptions.push({
        label: getAlertManagerLabel(extraConfig),
        value: extraConfig.name,
        imgUrl: extraConfig.imgUrl,
        meta: extraConfig.meta,
      });
    }

    // Add external alertmanagers
    if (datasourceAMs.length > 0) {
      groupedOptions.push({
        label: t('alerting.alert-manager-picker.external-alertmanagers-group', 'External Alertmanagers'),
        options: datasourceAMs.map((ds) => ({
          label: getAlertManagerLabel(ds),
          value: ds.name,
          imgUrl: ds.imgUrl,
          meta: ds.meta,
        })),
      });
    }

    return groupedOptions;
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
        noOptionsMessage={t(
          'alerting.alert-manager-picker.noOptionsMessage-no-datasources-found',
          'No datasources found'
        )}
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
  optionContent: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    whiteSpace: 'pre-line',
  }),
});

// custom option that overwrites the default "white-space: nowrap" for Alertmanager names that are really long
const CustomOption = (props: ComponentProps<typeof SelectMenuOptions>) => {
  const styles = useStyles2(getStyles);

  return (
    <SelectMenuOptions
      {...props}
      renderOptionLabel={({ label }) => <div className={styles.optionContent}>{label}</div>}
    />
  );
};
