import { useCallback, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useFlagKubernetesFolderCascadeDeleteAsync } from '@grafana/runtime/internal';
import { Alert, Button, ConfirmModal, Space, Stack, Text } from '@grafana/ui';

import { type DashboardTreeSelection } from '../../types';
import { getSelectedUIDs } from '../../utils/dashboards';
import { useOfferFolderMove } from '../../utils/useOfferFolderMove';
import { DeletedDashboardsInfo } from '../DeletedDashboardsInfo';

import { AffectedFolderContents } from './AffectedFolderContents';
import { CascadeDeleteWaiter } from './CascadeDeleteWaiter';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  /**
   * Called once, right before the modal dismisses itself, but only when every folder deleted here
   * finished cleanly (no cascade errors) -- use this instead of onDismiss (which also fires on
   * Cancel, and on the "stayed open to show an error" case below) for anything that should only
   * happen once it's actually safe to assume the delete fully succeeded, e.g. navigating away.
   */
  onSettled?: () => void;
}

interface ErroredFolder {
  uid: string;
  errors: string[];
}

export const DeleteModal = ({ onConfirm, onDismiss, onSettled, selectedItems, ...props }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [waitingOnFolderUIDs, setWaitingOnFolderUIDs] = useState<string[] | null>(null);
  const [erroredFolders, setErroredFolders] = useState<ErroredFolder[]>([]);
  const settledCountRef = useRef(0);
  const erroredRef = useRef<ErroredFolder[]>([]);
  const offerFolderMove = useOfferFolderMove();

  const selectedFolders = getSelectedUIDs(selectedItems, 'folder');
  const cascadeDeleteAsyncEnabled = useFlagKubernetesFolderCascadeDeleteAsync();

  const handleWaiterSettled = useCallback(
    (uid: string, outcome: 'success' | 'error', errors?: string[]) => {
      settledCountRef.current += 1;
      if (outcome === 'error') {
        erroredRef.current = [...erroredRef.current, { uid, errors: errors ?? [] }];
      }

      if (settledCountRef.current < (waitingOnFolderUIDs?.length ?? 0)) {
        return;
      }

      setIsDeleting(false);
      setWaitingOnFolderUIDs(null);
      if (erroredRef.current.length === 0) {
        onSettled?.();
        onDismiss();
      } else {
        // Leave the modal open to show what went wrong instead of silently closing as if the
        // delete had fully succeeded -- the folder(s) in question are still present (their
        // finalizer never cleared), and whoever triggered this needs a way to notice and act on
        // that, not just watch a spinner and then have the dialog vanish either way.
        setErroredFolders(erroredRef.current);
      }
    },
    [waitingOnFolderUIDs, onSettled, onDismiss]
  );

  const onDelete = async () => {
    reportInteraction('grafana_manage_dashboards_delete_clicked', {
      item_counts: {
        dashboard: Object.keys(selectedItems.dashboard).length,
        folder: Object.keys(selectedItems.folder).length,
      },
      source: 'browse_dashboards',
    });
    setIsDeleting(true);
    try {
      await onConfirm();
      if (selectedFolders.length > 0) {
        // The folder(s) just deleted may now be cascading asynchronously in the background --
        // keep the modal open (showing progress) until we've confirmed they're actually gone,
        // rather than dismissing as soon as the delete request was merely accepted.
        settledCountRef.current = 0;
        erroredRef.current = [];
        setWaitingOnFolderUIDs(selectedFolders);
      } else {
        setIsDeleting(false);
        onSettled?.();
        onDismiss();
      }
    } catch {
      setIsDeleting(false);
    }
  };

  const offerMoveOutOf = (folderUID: string) => {
    offerFolderMove(folderUID);
    onDismiss();
  };

  if (erroredFolders.length > 0) {
    return (
      <ConfirmModal
        title={t('browse-dashboards.action.delete-modal-error-title', 'Some deletes are stuck')}
        body={
          <Stack direction="column" gap={1}>
            {erroredFolders.map(({ uid, errors }) => (
              <Alert
                key={uid}
                severity="warning"
                title={t(
                  'browse-dashboards.action.delete-modal-error-alert-title',
                  'This folder could not be fully deleted'
                )}
              >
                {errors.length > 0 ? (
                  <ul>
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                ) : (
                  t(
                    'browse-dashboards.action.delete-modal-error-no-details',
                    'No details were reported -- it may resolve on its own on the next retry.'
                  )
                )}
                <Space v={1} />
                <Button size="sm" variant="secondary" onClick={() => offerMoveOutOf(uid)}>
                  {t('browse-dashboards.action.delete-modal-error-move-button', 'Move this folder instead')}
                </Button>
              </Alert>
            ))}
          </Stack>
        }
        confirmationText=""
        confirmText={t('browse-dashboards.action.delete-modal-error-dismiss', 'Close')}
        onConfirm={onDismiss}
        onDismiss={onDismiss}
        isOpen={props.isOpen}
      />
    );
  }

  return (
    <ConfirmModal
      body={
        <>
          <DeletedDashboardsInfo target="folder" cascadeAsync={selectedFolders.length > 0 && cascadeDeleteAsyncEnabled} />
          <Space v={2} />

          {waitingOnFolderUIDs ? (
            <Stack direction="column" gap={1}>
              <Text weight="medium">
                {t('browse-dashboards.action.delete-modal-cascade-in-progress', 'Deleting folder contents...')}
              </Text>
              {waitingOnFolderUIDs.map((uid) => (
                <CascadeDeleteWaiter key={uid} folderUID={uid} onSettled={handleWaiterSettled} />
              ))}
            </Stack>
          ) : (
            <AffectedFolderContents
              selectedItems={selectedItems}
              emptyMessage={t('browse-dashboards.action.delete-modal-folder-empty', '', {
                count: selectedFolders.length,
                defaultValue_one: 'Selected folder is empty',
                defaultValue_other: 'Selected folders are empty',
              })}
              nonEmptyMessage={t('browse-dashboards.action.delete-modal-folder-not-empty', '', {
                count: selectedFolders.length,
                defaultValue_one: 'Selected folder contains resources that will be deleted',
                defaultValue_other: 'Selected folders contain resources that will be deleted',
              })}
            />
          )}
          <Space v={2} />
        </>
      }
      confirmationText={t('browse-dashboards.action.confirmation-text', 'Delete')}
      confirmText={
        isDeleting || waitingOnFolderUIDs
          ? t('browse-dashboards.action.deleting', 'Deleting...')
          : t('browse-dashboards.action.delete-button', 'Delete')
      }
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title={t('browse-dashboards.action.delete-modal-title', 'Delete')}
      {...props}
      disabled={isDeleting || Boolean(waitingOnFolderUIDs)}
    />
  );
};
