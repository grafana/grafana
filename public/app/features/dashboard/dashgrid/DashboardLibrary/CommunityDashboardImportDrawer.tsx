import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { DataSourceInstanceSettings } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Button, Drawer, Field, LoadingPlaceholder, Stack, Alert } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { DataSourceInput, InputType } from 'app/features/manage-dashboards/state/reducers';

import { GnetDashboard } from './types';

interface Props {
  dashboard: GnetDashboard;
  onClose: () => void;
  onSubmit: (datasourceMappings: Record<string, string>) => void;
}

interface DataSourceMapping {
  [key: string]: DataSourceInstanceSettings;
}

/**
 * Drawer component for mapping datasources when importing a community dashboard
 */
export const CommunityDashboardImportDrawer = ({ dashboard, onClose, onSubmit: onSubmitCallback }: Props) => {
  const [inputs, setInputs] = useState<DataSourceInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ dataSources: DataSourceMapping }>({
    defaultValues: {
      dataSources: {},
    },
  });

  // Fetch dashboard details and extract datasource inputs
  useEffect(() => {
    const fetchDashboardInputs = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch dashboard JSON from grafana.com
        const gnetDashboard = await getBackendSrv().get(`/api/gnet/dashboards/${dashboard.id}`);
        const json = gnetDashboard.json;

        // Extract datasource inputs from __inputs array if it exists
        const dataSourceInputs: DataSourceInput[] = [];
        if (json.__inputs && Array.isArray(json.__inputs)) {
          json.__inputs.forEach(
            (input: { type: string; pluginId: string; name: string; label?: string; description?: string }) => {
              if (input.type === 'datasource') {
                dataSourceInputs.push({
                  name: input.name,
                  label: input.label || input.name,
                  info: `Select a ${input.pluginId} data source`,
                  description: input.description,
                  value: '',
                  type: InputType.DataSource,
                  pluginId: input.pluginId,
                });
              }
            }
          );
        }

        setInputs(dataSourceInputs);
      } catch (err) {
        console.error('Failed to fetch dashboard details:', err);
        setError('Failed to load dashboard details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardInputs();
  }, [dashboard.id]);

  const onSubmit = (data: { dataSources: DataSourceMapping }) => {
    // Convert DataSourceMapping to simple pluginId -> uid mapping
    const mappings: Record<string, string> = {};
    Object.entries(data.dataSources).forEach(([key, ds]) => {
      mappings[key] = ds.uid;
    });

    onSubmitCallback(mappings);
  };

  return (
    <Drawer
      title={
        <Trans i18nKey="dashboard.community-preview.drawer-title">Configure Data Sources for {dashboard.name}</Trans>
      }
      subtitle={
        <Trans i18nKey="dashboard.community-preview.drawer-subtitle">
          Select data sources to preview this dashboard
        </Trans>
      }
      onClose={onClose}
      size="md"
    >
      {loading && (
        <LoadingPlaceholder text={<Trans i18nKey="dashboard.community-preview.loading">Loading dashboard...</Trans>} />
      )}

      {error && (
        <Alert severity="error" title={t('dashboard.community-preview.error-title', 'Error loading dashboard')}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack direction="column" gap={2}>
            {inputs.length === 0 ? (
              <Alert
                severity="info"
                title={t('dashboard.community-preview.no-config-needed', 'No datasource configuration needed')}
              >
                <Trans i18nKey="dashboard.community-preview.no-datasources">
                  This dashboard does not require any datasource configuration.
                </Trans>
              </Alert>
            ) : (
              <>
                <Trans i18nKey="dashboard.community-preview.datasource-mapping-description">
                  Select which data sources to use for previewing this dashboard:
                </Trans>
                {inputs.map((input, index) => {
                  if (input.pluginId === ExpressionDatasourceRef.type) {
                    return null;
                  }
                  // Use input.name (e.g., "DS_PROMETHEUS") as the key to match __inputs array
                  const dataSourceOption = `dataSources.${input.name}` as const;
                  return (
                    <Field
                      label={input.label || input.name}
                      description={input.description || input.info}
                      key={dataSourceOption}
                      invalid={!!errors.dataSources?.[input.name]}
                      error={errors.dataSources?.[input.name] && 'A data source is required'}
                      noMargin
                    >
                      <Controller
                        name={dataSourceOption}
                        render={({ field: { ref, onChange, value, ...field } }) => (
                          <DataSourcePicker
                            {...field}
                            current={value?.uid}
                            onChange={(ds) => onChange(ds)}
                            noDefault={true}
                            placeholder={input.info}
                            pluginId={input.pluginId}
                          />
                        )}
                        control={control}
                        rules={{ required: true }}
                      />
                    </Field>
                  );
                })}
              </>
            )}

            <Stack direction="row" gap={2} justifyContent="flex-end">
              <Button variant="secondary" onClick={onClose} type="button">
                <Trans i18nKey="dashboard.community-preview.cancel">Cancel</Trans>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Trans i18nKey="dashboard.community-preview.use-dashboard">Use this dashboard</Trans>
              </Button>
            </Stack>
          </Stack>
        </form>
      )}
    </Drawer>
  );
};
