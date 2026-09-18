import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';

import { t } from '@grafana/i18n';
import { isFetchError, locationService } from '@grafana/runtime';
import { Alert, Space, Stack, Text } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { useCascadeDeleteProgress } from '../utils/useCascadeDeleteProgress';
import { usePropagateCascadeDeleteToChildren } from '../utils/usePropagateCascadeDeleteToChildren';
import { useTrustCascadeDoneSignal } from '../utils/useTrustCascadeDoneSignal';

import { CascadeDeleteErrorList } from './CascadeDeleteErrorList';
import { CascadeDeleteProgressBar } from './CascadeDeleteProgressBar';
import { FolderDeletedModal } from './FolderDeletedModal';

const POLL_INTERVAL_MS = 5000;

interface Props {
  folderUID: string;
  /**
   * UID of this folder's direct parent, if any. A folder that's itself blocking its *parent's*
   * cascade delete (e.g. a non-empty legacy subfolder, or this PoC's demo failure hack) has no
   * deletionTimestamp or status of its own to show that -- the error only exists on the parent's
   * status, naming this folder by UID (see cascade_delete_controller.go). Without this, standing
   * on such a folder's own page shows nothing at all, even though it's the actual problem.
   */
  parentUID?: string;
}

/**
 * Surfaces a folder's own cascade-delete status on its own page -- for the person who triggered
 * the delete if they navigated back here (e.g. after closing the delete confirmation dialog
 * before it settled), or for anyone else who opens this folder while it's cascading and wouldn't
 * otherwise have any indication that something is happening (it's not visible unless you're
 * looking at whichever list happens to still be showing this folder's row as a child -- see
 * DeletingFolderBadge -- which doesn't apply when you're standing inside the folder itself).
 * Polls independently of that mechanism since a completely different user, with nothing in their
 * own cascadeDeletingUIDs, might be the one to land here. Also marks this folder's own children
 * as cascade-deleting (see usePropagateCascadeDeleteToChildren) and, once the folder itself is
 * confirmed gone, shows FolderDeletedModal instead of silently redirecting away.
 */
export function FolderCascadeStatusBanner({ folderUID, parentUID }: Props) {
  const { data, error } = useGetFolderQuery(
    { name: folderUID },
    { pollingInterval: POLL_INTERVAL_MS, refetchOnMountOrArgChange: true }
  );
  const { data: parentData } = useGetFolderQuery(parentUID ? { name: parentUID } : skipToken, {
    pollingInterval: POLL_INTERVAL_MS,
  });
  const cascadeDelete = data?.status?.cascadeDelete;
  // `remaining` defaults to 0 in the API's zero-value struct, indistinguishable from a
  // genuinely-confirmed "nothing left" unless the controller has actually reconciled this folder
  // at least once (state only gets set once it has).
  const trustworthyRemaining = cascadeDelete?.state === 'working' ? cascadeDelete.remaining : undefined;
  const percent = useCascadeDeleteProgress(trustworthyRemaining);
  const isDeleting = Boolean(data?.metadata?.deletionTimestamp);
  const isGone = isFetchError(error) && error.status === 404;
  const canTrustGone = useTrustCascadeDoneSignal(isDeleting);

  // This folder isn't cascading itself, but its parent's cascade may have named it directly.
  const parentCascadeDelete = parentData?.status?.cascadeDelete;
  const blockingParentErrors =
    !isDeleting && parentCascadeDelete?.state === 'error'
      ? parentCascadeDelete.errors?.filter((err) => err.includes(folderUID))
      : undefined;

  usePropagateCascadeDeleteToChildren(folderUID, isDeleting, cascadeDelete?.errors);

  const [showDeletedModal, setShowDeletedModal] = useState(false);
  if (isGone && canTrustGone && !showDeletedModal) {
    setShowDeletedModal(true);
  }

  if (showDeletedModal) {
    return <FolderDeletedModal isOpen onGoToDashboards={() => locationService.push('/dashboards')} />;
  }

  if (!isDeleting) {
    if (blockingParentErrors && blockingParentErrors.length > 0) {
      return (
        <>
          <Alert
            severity="warning"
            title={t(
              'browse-dashboards.folder-cascade-status-banner.blocking-parent-title',
              "This folder is blocking its parent folder's deletion"
            )}
          >
            <Text>
              {t(
                'browse-dashboards.folder-cascade-status-banner.blocking-parent-fix-instructions',
                "This folder's parent is being deleted, but can't finish while this one is in the way. Try moving this folder elsewhere, deleting it directly, or fixing whatever's blocking it below. Deletion retries automatically once it's resolved:"
              )}
            </Text>
            <CascadeDeleteErrorList errors={blockingParentErrors} />
          </Alert>
          <Space v={2} />
        </>
      );
    }
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
            <>
              <Text>
                {t(
                  'browse-dashboards.folder-cascade-status-banner.error-fix-instructions',
                  "These items need manual attention -- try moving them to another folder, deleting them directly, or fixing whatever's blocking them below. Deletion retries automatically once they're resolved:"
                )}
              </Text>
              <CascadeDeleteErrorList errors={cascadeDelete.errors} />
            </>
          ) : (
            t(
              'browse-dashboards.folder-cascade-status-banner.no-details',
              'No error details were reported. This may resolve on its own on the next retry.'
            )
          )}
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
              {trustworthyRemaining
                ? t('browse-dashboards.folder-cascade-status-banner.working-remaining', '', {
                    count: trustworthyRemaining,
                    defaultValue_one:
                      '{{count}} item left to delete in the background. Folder actions are disabled until it finishes.',
                    defaultValue_other:
                      '{{count}} items left to delete in the background. Folder actions are disabled until it finishes.',
                  })
                : t(
                    'browse-dashboards.folder-cascade-status-banner.working-no-count',
                    'Deleting in the background. Folder actions are disabled until it finishes.'
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
