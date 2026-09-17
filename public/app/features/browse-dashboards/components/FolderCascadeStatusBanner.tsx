import { t } from '@grafana/i18n';
import { Alert, Button, Space, Stack, Text } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { useCascadeDeleteProgress } from '../utils/useCascadeDeleteProgress';
import { useOfferFolderMove } from '../utils/useOfferFolderMove';

import { CascadeDeleteProgressBar } from './CascadeDeleteProgressBar';

const POLL_INTERVAL_MS = 5000;

interface Props {
  folderUID: string;
}

/**
 * Surfaces a folder's own cascade-delete status on its own page -- for the person who triggered
 * the delete if they navigated back here (e.g. after closing the delete confirmation dialog
 * before it settled), or for anyone else who opens this folder while it's cascading and wouldn't
 * otherwise have any indication that something is happening (it's not visible unless you're
 * looking at whichever list happens to still be showing this folder's row as a child -- see
 * DeletingFolderBadge -- which doesn't apply when you're standing inside the folder itself).
 * Polls independently of that mechanism since a completely different user, with nothing in their
 * own cascadeDeletingUIDs, might be the one to land here.
 */
export function FolderCascadeStatusBanner({ folderUID }: Props) {
  const { data } = useGetFolderQuery({ name: folderUID }, { pollingInterval: POLL_INTERVAL_MS });
  const offerFolderMove = useOfferFolderMove();
  const cascadeDelete = data?.status?.cascadeDelete;
  const percent = useCascadeDeleteProgress(cascadeDelete?.remaining);

  if (!data?.metadata?.deletionTimestamp) {
    return null;
  }

  if (cascadeDelete?.state === 'error') {
    return (
      <>
        <Alert
          severity="warning"
          title={t(
            'browse-dashboards.folder-cascade-status-banner.error-title',
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
              'browse-dashboards.folder-cascade-status-banner.no-details',
              'No details were reported -- it may resolve on its own on the next retry.'
            )
          )}
          <Button size="sm" variant="secondary" onClick={() => offerFolderMove(folderUID)}>
            {t('browse-dashboards.folder-cascade-status-banner.move-button', 'Move this folder instead')}
          </Button>
        </Alert>
        <Space v={2} />
      </>
    );
  }

  return (
    <>
      <Alert
        severity="info"
        title={t('browse-dashboards.folder-cascade-status-banner.working-title', 'This folder is being deleted')}
      >
        <Stack direction="column" gap={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Text color="secondary">
              {cascadeDelete?.remaining
                ? t('browse-dashboards.folder-cascade-status-banner.working-remaining', '', {
                    count: cascadeDelete.remaining,
                    defaultValue_one: 'Deleting its contents in the background -- {{count}} item left.',
                    defaultValue_other: 'Deleting its contents in the background -- {{count}} items left.',
                  })
                : t(
                    'browse-dashboards.folder-cascade-status-banner.working-no-count',
                    'Deleting its contents in the background. This page will stop working once it finishes.'
                  )}
            </Text>
            {percent !== undefined && (
              <Text color="secondary" variant="bodySmall">
                {t('browse-dashboards.folder-cascade-status-banner.working-percent', '{{percent}}%', { percent })}
              </Text>
            )}
          </Stack>
          <CascadeDeleteProgressBar percent={percent} />
        </Stack>
      </Alert>
      <Space v={2} />
    </>
  );
}
