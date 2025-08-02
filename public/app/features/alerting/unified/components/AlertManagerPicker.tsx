import { css } from '@emotion/css';
import { ComponentProps, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, InlineField, Select, SelectMenuOptions, useStyles2 } from '@grafana/ui';

import { useAlertmanager } from '../state/AlertmanagerContext';
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

function isExtraConfig(name: string): boolean {
  return name.startsWith('__grafana-converted-extra-config-');
}

function getExtraConfigIdentifier(name: string): string {
  return name.replace('__grafana-converted-extra-config-', '');
}

export const AlertManagerPicker = ({ disabled = false }: Props) => {
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager, availableAlertManagers, setSelectedAlertmanager } = useAlertmanager();

  const options = useMemo(() => {
    // Group alertmanagers
    const grafanaAM = availableAlertManagers.find((am) => am.name === GRAFANA_RULES_SOURCE_NAME);
    const extraConfigs = availableAlertManagers.filter((am) => isExtraConfig(am.name));
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

    // Add extra configs
    extraConfigs.forEach((ec) => {
      groupedOptions.push({
        label: getAlertManagerLabel(ec),
        value: ec.name,
        imgUrl: ec.imgUrl,
        meta: ec.meta,
      });
    });

    // Add datasource alertmanagers in a group
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
});

// custom option that overwrites the default "white-space: nowrap" for Alertmanager names that are really long
// and adds extra config badge
const CustomOption = (props: ComponentProps<typeof SelectMenuOptions>) => {
  const { data } = props;
  const alertManagerName = String(data?.value || '');

  if (isExtraConfig(alertManagerName)) {
    const identifier = getExtraConfigIdentifier(alertManagerName);
    return (
      <SelectMenuOptions
        {...props}
        renderOptionLabel={() => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'pre-line' }}>
            <span>{identifier}</span>
            <Badge text={t('alerting.alert-manager-picker.extra-config-badge', 'Extra Config')} color="blue" />
          </div>
        )}
      />
    );
  }

  return (
    <SelectMenuOptions
      {...props}
      renderOptionLabel={({ label }) => <div style={{ whiteSpace: 'pre-line' }}>{label}</div>}
    />
  );
};
