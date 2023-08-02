import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { dateTime, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, HorizontalGroup, Select, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { FormValues } from './AlertmanagerConfig';
import { ConfigEditor } from './ConfigEditor';

export interface ValidAmConfigOption {
  label?: string;
  value?: AlertManagerCortexConfig;
}

interface AlertmanagerConfigSelectorProps {
  onChange: (selectedOption: ValidAmConfigOption) => void;
  selectedAmConfig?: ValidAmConfigOption;
  defaultValues: FormValues;
  onSubmit: (values: FormValues, oldConfig?: AlertManagerCortexConfig) => void;
  readOnly: boolean;
  loading: boolean;
}

export default function AlertmanagerConfigSelector({
  onChange,
  selectedAmConfig,
  defaultValues,
  onSubmit,
  readOnly,
  loading,
}: AlertmanagerConfigSelectorProps): JSX.Element {
  const { useGetValidAlertManagersConfigQuery, useResetAlertManagerConfigToOldVersionMutation } = alertmanagerApi;

  const styles = useStyles2(getStyles);

  const { currentData: validAmConfigs, isLoading: isFetchingValidAmConfigs } = useGetValidAlertManagersConfigQuery();

  const [resetAlertManagerConfigToOldVersion] = useResetAlertManagerConfigToOldVersionMutation();

  const validAmConfigsOptions = useMemo(() => {
    if (!validAmConfigs?.length) {
      return [];
    }

    const configs: ValidAmConfigOption[] = validAmConfigs.map((config) => {
      const date = new Date(config.last_applied!);
      return {
        label: config.last_applied
          ? `Config from ${date.toLocaleString()} (${dateTime(date).locale('en').fromNow(true)} ago)`
          : 'Previous config',
        value: config,
      };
    });
    onChange(configs[0]);
    return configs;
  }, [validAmConfigs, onChange]);

  const onResetClick = async () => {
    const id = selectedAmConfig?.value?.id;
    if (id === undefined) {
      return;
    }

    resetAlertManagerConfigToOldVersion({ id });
  };

  return (
    <>
      {!isFetchingValidAmConfigs && validAmConfigs && validAmConfigs.length > 0 ? (
        <>
          <div>Select a previous working configuration until you fix this error:</div>

          <div className={styles.container}>
            <HorizontalGroup align="flex-start" spacing="md">
              <Select
                options={validAmConfigsOptions}
                value={selectedAmConfig}
                onChange={(value: SelectableValue) => {
                  onChange(value);
                }}
              />

              <Button variant="primary" disabled={loading} onClick={onResetClick}>
                Reset to selected configuration
              </Button>
            </HorizontalGroup>
          </div>

          <ConfigEditor
            defaultValues={defaultValues}
            onSubmit={(values) => onSubmit(values)}
            readOnly={readOnly}
            loading={loading}
            alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
          />
        </>
      ) : null}
    </>
  );
}
const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
  `,
});
