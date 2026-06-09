import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, Stack } from '@grafana/ui';

import { type DataSourceRights } from '../types';

import { DataSourceReadOnlyMessage } from './DataSourceReadOnlyMessage';

export type Props = {
  errorMsg?: string | null;
  dataSourceRights: DataSourceRights;
  onDelete: () => void;
  notFound: boolean;
};

export function DataSourceLoadError({ dataSourceRights, onDelete, notFound, errorMsg }: Props) {
  const { readOnly, hasDeleteRights } = dataSourceRights;
  const canDelete = !readOnly && hasDeleteRights;
  const navigateBack = () => window.history.back();

  return (
    <>
      {readOnly && <DataSourceReadOnlyMessage />}
      <Stack direction="column">
        <Stack direction="column" alignItems={notFound ? 'center' : 'flex-start'}>
          {notFound ? (
            <EmptyState
              variant="not-found"
              message={t('datasources.data-source-load-error.not-found', 'Data source not found')}
            />
          ) : (
            <Alert
              severity="error"
              title={errorMsg ?? t('datasources.data-source-load-error.load-error-title', 'Error loading plugin')}
            >
              <Trans i18nKey="datasources.data-source-load-error.check-updates">
                An unknown error occurred while loading the plugin. Please check for updates.
              </Trans>
            </Alert>
          )}
        </Stack>
        <Stack direction="row" gap={2}>
          {canDelete && (
            <Button type="submit" variant="destructive" onClick={onDelete}>
              <Trans i18nKey="datasources.data-source-load-error.delete">Delete</Trans>
            </Button>
          )}

          <Button variant="secondary" fill="outline" type="button" onClick={navigateBack}>
            <Trans i18nKey="datasources.data-source-load-error.back">Back</Trans>
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
