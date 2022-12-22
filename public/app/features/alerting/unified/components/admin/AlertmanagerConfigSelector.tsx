import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2 } from '@grafana/ui';
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
  onSubmit: (
    values: FormValues,
    checkConflictsWithExistingConfig: boolean,
    oldConfig?: AlertManagerCortexConfig
  ) => void;
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
  const { useGetValidAlertManagersConfigQuery } = alertmanagerApi;

  const styles = useStyles2(getStyles);

  const { currentData: validAmConfigs, isLoading: isFetchingValidAmConfigs } = useGetValidAlertManagersConfigQuery();

  const validAmConfigsOptions = useMemo(() => {
    if (!validAmConfigs?.length) {
      return [];
    }

    const configs: ValidAmConfigOption[] = validAmConfigs.map((config) => ({
      label: config.successfully_applied_at
        ? `Config from ${new Date(config.successfully_applied_at).toLocaleString()}`
        : 'Previous config',
      value: config,
    }));
    onChange(configs[0]);
    return configs;
  }, [validAmConfigs, onChange]);

  return (
    <>
      {!isFetchingValidAmConfigs && validAmConfigs && validAmConfigs.length > 0 ? (
        <>
          <div>Select a previous working configuration until you fix this error:</div>

          <Select
            className={styles.container}
            options={validAmConfigsOptions}
            value={selectedAmConfig}
            onChange={(value: SelectableValue) => {
              onChange(value);
            }}
          />

          <ConfigEditor
            defaultValues={defaultValues}
            onSubmit={(values) => onSubmit(values, false, selectedAmConfig?.value)}
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
    margin-bottom: ${theme.spacing(4)};
  `,
});
