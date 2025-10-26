import { t, Trans } from '@grafana/i18n';
import { Button, EmptyState, Stack } from '@grafana/ui';

import { DataSourceRights } from '../types';

import { DataSourceReadOnlyMessage } from './DataSourceReadOnlyMessage';

export type Props = {
  dataSourceRights: DataSourceRights;
  onDelete: () => void;
  notFound: boolean;
};

export function DataSourceLoadError({ dataSourceRights, onDelete, notFound }: Props) {
  const { readOnly, hasDeleteRights } = dataSourceRights;
  const canDelete = !readOnly && hasDeleteRights;
  const navigateBack = () => window.history.back();

  return (
    <>
      {readOnly && <DataSourceReadOnlyMessage />}
      <Stack direction="column" gap={1}>
        <Stack direction="column" alignItems="center" gap={1}>
          {notFound && (
            <EmptyState
              variant="not-found"
              message={t('datasources.data-source-load-error.not-found', 'Data source not found')}
            />
          )}
        </Stack>
        <Stack direction="row" gap={2} alignItems="flex-start">
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
