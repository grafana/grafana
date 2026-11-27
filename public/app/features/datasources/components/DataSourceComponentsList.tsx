import { t, Trans } from '@grafana/i18n';
import { locationService, useDataSourceInstanceList } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { Alert, Button, ButtonCascader } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ROUTES } from 'app/features/connections/constants';
import { useComponentDescriptors } from 'app/features/plugins/extensions/useComponentDescriptors';
import { AccessControlAction } from 'app/types/accessControl';

import { DATASOURCE_COMPONENTS_PAGE_ID } from '../utils';

import { DataSourceComponentCard, DataSourceComponentGrid } from './DataSourceComponentCard';

export function DataSourceComponentsList({ type }: { type: string }) {
  const { entries, loading, error, retry } = useComponentDescriptors(type);
  const { value: providers } = useAppPluginMetas();
  const { items, isLoading: instancesLoading, error: instancesError } = useDataSourceInstanceList({ type, all: true });

  if (loading) {
    return (
      <p role="status">
        <Trans i18nKey="datasources.components.loading">Loading components…</Trans>
      </p>
    );
  }

  if (error) {
    return (
      <Alert severity="error" title={t('datasources.components.load-error', 'Could not load components')}>
        <Button type="button" onClick={retry}>
          <Trans i18nKey="datasources.components.retry">Retry</Trans>
        </Button>
      </Alert>
    );
  }

  if (!entries.length) {
    return (
      <p>
        <Trans i18nKey="datasources.components.empty">No components are available for this data source type.</Trans>
      </p>
    );
  }

  const providersById = new Map(providers?.map((provider) => [provider.id, provider]));
  const instanceOptions = items
    .filter((item) => item.type === type && !item.meta.builtIn)
    .map(({ uid, name }) => ({ value: uid, label: name }));
  const previewDisabled =
    instancesLoading ||
    !!instancesError ||
    !instanceOptions.length ||
    !contextSrv.hasPermission(AccessControlAction.DataSourcesRead) ||
    !contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);

  return (
    <DataSourceComponentGrid>
      {entries.map((entry) => (
        <DataSourceComponentCard key={entry.id} entry={entry} provider={providersById.get(entry.pluginId)}>
          <ButtonCascader
            options={instanceOptions}
            icon="eye"
            variant="secondary"
            disabled={previewDisabled}
            buttonProps={{
              size: 'sm',
              fill: 'outline',
              'aria-label': t('datasources.components.preview-component', 'Preview {{title}}', {
                title: entry.title,
              }),
            }}
            onChange={([uid]) => {
              if (!uid) {
                return;
              }
              const path = ROUTES.DataSourcesEdit.replace(':uid', encodeURIComponent(uid));
              const params = new URLSearchParams({ page: DATASOURCE_COMPONENTS_PAGE_ID, component: entry.id });
              locationService.push(`${path}?${params}`);
            }}
          >
            {t('datasources.components.preview', 'Preview with...')}
          </ButtonCascader>
        </DataSourceComponentCard>
      ))}
    </DataSourceComponentGrid>
  );
}
