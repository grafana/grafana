import { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Stack, Text, Button, Alert, Field, Input, Box } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { DashboardInput, DataSourceInput } from 'app/features/manage-dashboards/state/reducers';

import { ContentKind, DashboardLibraryInteractions, EventLocation, SOURCE_ENTRY_POINTS } from './interactions';
import { InputMapping, mapConstantInputs } from './utils/autoMapDatasources';

interface Props {
  unmappedInputs: DataSourceInput[];
  constantInputs: DashboardInput[];
  existingMappings: InputMapping[];
  onBack: () => void;
  onPreview: (allMappings: InputMapping[]) => void;
  dashboardName: string;
  libraryItemId: string;
  eventLocation: EventLocation;
  contentKind: ContentKind;
  datasourceTypes: string[];
}

interface UserSelectedDatasourceMappings {
  name: string;
  pluginId: string;
  datasource: DataSourceInstanceSettings | undefined;
}

export const CommunityDashboardMappingForm = ({
  unmappedInputs,
  constantInputs,
  existingMappings,
  onBack,
  onPreview,
  dashboardName,
  libraryItemId,
  eventLocation,
  contentKind,
  datasourceTypes,
}: Props) => {
  // Track mapping form shown on mount
  useEffect(() => {
    DashboardLibraryInteractions.mappingFormShown({
      contentKind,
      datasourceTypes,
      libraryItemId,
      libraryItemTitle: dashboardName,
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      eventLocation,
      unmappedInputsCount: unmappedInputs.length,
      constantInputsCount: constantInputs.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [userSelectedDsMappings, setUserSelectedDsMappings] = useState<Record<string, UserSelectedDatasourceMappings>>(
    () => {
      // Initialize with existing unmapped inputs
      return unmappedInputs.reduce<Record<string, UserSelectedDatasourceMappings>>((acc, input) => {
        const unmappedInput = {
          name: input.name,
          pluginId: input.pluginId,
          datasource: undefined,
        };
        acc[input.name] = unmappedInput;
        return acc;
      }, {});
    }
  );

  const [constantValues, setConstantValues] = useState<Record<string, string>>(() => {
    // Initialize with default values from constantInputs
    return constantInputs.reduce<Record<string, string>>((acc, input) => {
      acc[input.name] = input.value;
      return acc;
    }, {});
  });

  const onDatasourceSelect = (inputName: string, datasource: DataSourceInstanceSettings) => {
    setUserSelectedDsMappings((prev) => ({
      ...prev,
      [inputName]: {
        ...prev[inputName],
        datasource,
      },
    }));
  };

  const onConstantChange = (inputName: string, value: string) => {
    setConstantValues((prev) => ({
      ...prev,
      [inputName]: value,
    }));
  };

  const onPreviewClick = () => {
    // Track mapping form completion
    DashboardLibraryInteractions.mappingFormCompleted({
      contentKind,
      datasourceTypes,
      libraryItemId,
      libraryItemTitle: dashboardName,
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      eventLocation,
      userMappedCount: unmappedInputs.length,
      autoMappedCount: existingMappings.length,
    });

    // Combine all mappings:
    // 1. Existing auto-mapped datasources
    // 2. User-selected datasources
    // 3. Constant values (user-edited or defaults)

    const userSelectedDatasources: InputMapping[] = unmappedInputs.map((input) => ({
      name: input.name,
      type: 'datasource',
      pluginId: input.pluginId,
      value: userSelectedDsMappings[input.name]?.datasource?.uid || '',
    }));

    const constantMappings = mapConstantInputs(constantInputs, constantValues);

    const allMappings = [...existingMappings, ...userSelectedDatasources, ...constantMappings];
    onPreview(allMappings);
  };

  // Check if all unmapped datasource inputs have been mapped by user
  // Constants are optional (have default values)
  const allDatasourcesMapped = unmappedInputs.every((input) => userSelectedDsMappings[input.name]?.datasource);

  return (
    <Stack direction="column" gap={3} height="100%" justifyContent="space-between">
      <Stack direction="column" gap={3}>
        <Text element="p" color="secondary">
          <Trans i18nKey="dashboard-library.community-mapping-form.description">
            This dashboard requires datasource configuration. Select datasources for each input below.
          </Trans>
        </Text>

        {existingMappings.length > 0 && (
          <Alert title="" severity="info">
            <Stack direction="column" gap={1}>
              <Text>
                <Trans i18nKey="dashboard-library.community-mapping-form.auto-mapped" count={existingMappings.length}>
                  {{ count: existingMappings.length }} datasources were automatically configured:
                </Trans>
              </Text>
              <Text color="secondary">
                {existingMappings
                  .map((mapping) => {
                    const ds = getDataSourceSrv().getInstanceSettings(mapping.value);
                    return `${mapping.pluginId} → ${ds?.name || mapping.value}`;
                  })
                  .join(' | ')}
              </Text>
            </Stack>
          </Alert>
        )}

        {unmappedInputs.length > 0 && (
          <Stack direction="column" gap={2}>
            <Text element="h4" weight="medium">
              <Trans i18nKey="dashboard-library.community-mapping-form.datasources-title">
                Datasource Configuration
              </Trans>
            </Text>
            {unmappedInputs.map((input) => {
              const selectedDatasource = userSelectedDsMappings[input.name]?.datasource;

              return (
                <Field
                  key={input.name}
                  label={input.label || input.name}
                  description={input.description}
                  invalid={false}
                  noMargin
                >
                  <DataSourcePicker
                    onChange={(ds) => onDatasourceSelect(input.name, ds)}
                    current={selectedDatasource?.uid}
                    noDefault={true}
                    placeholder={
                      input.info || t('dashboard-library.community-mapping-select-datasource', 'Select a datasource')
                    }
                    pluginId={input.pluginId}
                  />
                </Field>
              );
            })}
          </Stack>
        )}

        {constantInputs.length > 0 && (
          <Stack direction="column" gap={2}>
            <Text element="h4" weight="medium">
              <Trans i18nKey="dashboard-library.community-mapping-form.constants-title">Dashboard Variables</Trans>
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
                  onChange={(e) => onConstantChange(input.name, e.currentTarget.value)}
                  placeholder={input.value}
                />
              </Field>
            ))}
          </Stack>
        )}
      </Stack>

      <Box paddingBottom={3}>
        <Stack direction="row" justifyContent="space-between" gap={2}>
          <Button variant="secondary" icon="arrow-left" onClick={onBack}>
            <Trans i18nKey="dashboard-library.community-mapping-form.back">Back to dashboards</Trans>
          </Button>
          <Button onClick={onPreviewClick} disabled={!allDatasourcesMapped}>
            <Trans i18nKey="dashboard-library.community-mapping-form.preview">Preview dashboard</Trans>
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
};
