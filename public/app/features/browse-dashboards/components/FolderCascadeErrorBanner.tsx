import { t } from '@grafana/i18n';
import { Alert, Button, Space } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { useOfferFolderMove } from '../utils/useOfferFolderMove';

const POLL_INTERVAL_MS = 5000;

interface Props {
  folderUID: string;
}

/**
 * Surfaces a folder's own cascade-delete errors on its own page -- for the person who triggered
 * the delete if they navigated back here, or for anyone else who opens this folder later and
 * wouldn't otherwise have any indication that something is wrong (it's not visible unless you're
 * looking at whichever list happens to still be showing this folder's row -- see
 * DeletingFolderBadge). Polls independently of that mechanism since a completely different user,
 * with nothing in their own cascadeDeletingUIDs, might be the one to land here.
 */
export function FolderCascadeErrorBanner({ folderUID }: Props) {
  const { data } = useGetFolderQuery({ name: folderUID }, { pollingInterval: POLL_INTERVAL_MS });
  const offerFolderMove = useOfferFolderMove();

  const cascadeDelete = data?.status?.cascadeDelete;
  if (!data?.metadata?.deletionTimestamp || cascadeDelete?.state !== 'error') {
    return null;
  }

  return (
    <>
      <Alert
        severity="warning"
        title={t(
          'browse-dashboards.folder-cascade-error-banner.title',
          'This folder is stuck deleting some of its contents'
        )}
      >
        {cascadeDelete.errors && cascadeDelete.errors.length > 0 ? (
          <ul>
            {cascadeDelete.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        ) : (
          t(
            'browse-dashboards.folder-cascade-error-banner.no-details',
            'No details were reported -- it may resolve on its own on the next retry.'
          )
        )}
        <Button size="sm" variant="secondary" onClick={() => offerFolderMove(folderUID)}>
          {t('browse-dashboards.folder-cascade-error-banner.move-button', 'Move this folder instead')}
        </Button>
      </Alert>
      <Space v={2} />
    </>
  );
}
