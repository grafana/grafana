import { css } from '@emotion/css';
import { useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Stack, Text, Button, Alert, useStyles2, Field, Input } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { DashboardInput, DataSourceInput } from 'app/features/manage-dashboards/state/reducers';

import { InputMapping, mapConstantInputs } from './utils/autoMapDatasources';

interface Props {
  dashboardName: string;
  unmappedInputs: DataSourceInput[];
  constantInputs: DashboardInput[];
  existingMappings: InputMapping[];
  onBack: () => void;
  onPreview: (allMappings: InputMapping[]) => void;
}

export const CommunityDashboardMappingForm = ({
  dashboardName,
  unmappedInputs,
  constantInputs,
  existingMappings,
  onBack,
  onPreview,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [userDatasourceMappings, setUserDatasourceMappings] = useState<Record<string, DataSourceInstanceSettings>>({});
  const [constantValues, setConstantValues] = useState<Record<string, string>>(() => {
    // Initialize with default values from constantInputs
    const initial: Record<string, string> = {};
    constantInputs.forEach((input) => {
      initial[input.name] = input.value;
    });
    return initial;
  });

  const handleDatasourceSelect = (inputName: string, datasource: DataSourceInstanceSettings) => {
    setUserDatasourceMappings((prev) => ({
      ...prev,
      [inputName]: datasource,
    }));
  };

  const handleConstantChange = (inputName: string, value: string) => {
    setConstantValues((prev) => ({
      ...prev,
      [inputName]: value,
    }));
  };

  const handlePreview = () => {
    // Combine all mappings:
    // 1. Existing auto-mapped datasources
    // 2. User-selected datasources
    // 3. Constant values (user-edited or defaults)

    const userSelectedDatasources: InputMapping[] = unmappedInputs.map((input) => ({
      name: input.name,
      type: 'datasource',
      pluginId: input.pluginId,
      value: userDatasourceMappings[input.name]?.uid || '',
    }));

    const constantMappings = mapConstantInputs(constantInputs, constantValues);

    const allMappings = [...existingMappings, ...userSelectedDatasources, ...constantMappings];
    onPreview(allMappings);
  };

  // Check if all unmapped datasource inputs have been mapped by user
  // Constants are optional (have default values)
  const allDatasourcesMapped = unmappedInputs.every((input) => userDatasourceMappings[input.name]);

  return (
    <Stack direction="column" gap={3}>
      <div>
        <Text element="p" color="secondary">
          <Trans i18nKey="dashboard.library.community-mapping-form.description">
            This dashboard requires datasource configuration. Select datasources for each input below.
          </Trans>
        </Text>
        <div className={styles.dashboardName}>
          <Text element="p" weight="medium">
            {dashboardName}
          </Text>
        </div>
      </div>

      {existingMappings.length > 0 && (
        <Alert title="" severity="info">
          <Stack direction="column" gap={1}>
            <Text>
              <Trans i18nKey="dashboard.library.community-mapping-form.auto-mapped" count={existingMappings.length}>
                {{ count: existingMappings.length }} datasources were automatically configured:
              </Trans>
            </Text>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {existingMappings.map((mapping) => {
                const ds = getDataSourceSrv().getInstanceSettings(mapping.value);
                return (
                  <li key={mapping.name}>
                    <Text color="secondary">
                      <strong>{mapping.name}</strong> → {ds?.name || mapping.value}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </Stack>
        </Alert>
      )}

      {/* Unmapped Datasource Inputs */}
      {unmappedInputs.length > 0 && (
        <Stack direction="column" gap={2}>
          <Text element="h4" weight="medium">
            <Trans i18nKey="dashboard.library.community-mapping-form.datasources-title">Datasource Configuration</Trans>
          </Text>
          {unmappedInputs.map((input) => {
            const selectedDatasource = userDatasourceMappings[input.name];

            return (
              <Field
                key={input.name}
                label={input.label || input.name}
                description={input.description}
                invalid={false}
                noMargin
              >
                <DataSourcePicker
                  onChange={(ds) => handleDatasourceSelect(input.name, ds)}
                  current={selectedDatasource?.uid}
                  noDefault={true}
                  placeholder={
                    input.info || t('dashboard.library.community-mapping-select-datasource', 'Select a datasource')
                  }
                  pluginId={input.pluginId}
                />
              </Field>
            );
          })}
        </Stack>
      )}

      {/* Constant Inputs */}
      {constantInputs.length > 0 && (
        <Stack direction="column" gap={2}>
          <Text element="h4" weight="medium">
            <Trans i18nKey="dashboard.library.community-mapping-form.constants-title">Dashboard Variables</Trans>
          </Text>
          {constantInputs.map((input) => (
            <Field
              key={input.name}
              label={input.label || input.name}
              description={input.description || input.info}
              noMargin
            >
              <Input
                value={constantValues[input.name] || ''}
                onChange={(e) => handleConstantChange(input.name, e.currentTarget.value)}
                placeholder={input.value}
              />
            </Field>
          ))}
        </Stack>
      )}

      <Stack direction="row" justifyContent="space-between" gap={2}>
        <Button variant="secondary" icon="arrow-left" onClick={onBack}>
          <Trans i18nKey="dashboard.library.community-mapping-form.back">Back to dashboards</Trans>
        </Button>
        <Button onClick={handlePreview} disabled={!allDatasourcesMapped}>
          <Trans i18nKey="dashboard.library.community-mapping-form.preview">Preview dashboard</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    dashboardName: css({
      marginTop: theme.spacing(1),
    }),
  };
}
