import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, Modal, Space } from '@grafana/ui';
import { useGetAffectedItems } from 'app/api/clients/folder/v1beta1/hooks';
import { MoveActionAvailableTargetWarning } from 'app/features/provisioning/components/Shared/MoveActionAvailableTargetWarning';
import { ProvisioningAwareFolderPicker } from 'app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker';

import { type DashboardTreeSelection } from '../../types';

import { getFolderIsEmpty } from './utils';

export interface Props {
  isOpen: boolean;
  onConfirm: (targetFolderUid: string) => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const MoveModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [moveTarget, setMoveTarget] = useState<string>();
  const [isMoving, setIsMoving] = useState(false);
  const { data, isLoading } = useGetAffectedItems(selectedItems);

  const selectedFolders = Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]);
  const folderIsEmpty = getFolderIsEmpty(data, selectedItems);

  const onMove = async () => {
    if (moveTarget !== undefined) {
      setIsMoving(true);
      try {
        await onConfirm(moveTarget);
        setIsMoving(false);
        onDismiss();
      } catch {
        setIsMoving(false);
      }
    }
  };

  return (
    <Modal title={t('browse-dashboards.action.move-modal-title', 'Move')} onDismiss={onDismiss} {...props}>
      {selectedFolders.length > 0 && (
        <Alert
          severity="info"
          title={t('browse-dashboards.action.move-modal-alert', 'Moving this item may change its permissions.')}
        />
      )}

      <MoveActionAvailableTargetWarning />

      <Space v={2} />

      {!!selectedFolders?.length &&
        // Only show this if we have any folders selected. If user selected one or more specific resources, there
        // are no children that could be moved by accident.
        (isLoading ? (
          <Skeleton width={200} />
        ) : (
          // Compared to delete modal, we don't show "folder is empty" message, as for move it does not seem we need
          // that kind of confirmation.
          !folderIsEmpty && (
            <Alert
              title={t(
                'browse-dashboards.action.move-modal-folder-not-empty',
                'Selected folder contains other resources that will be moved with it',
                {
                  count: selectedFolders.length,
                  defaultValue_other: 'Selected folders contain other resources that will be moved with them',
                }
              )}
              severity={'warning'}
            />
          )
        ))}

      <Space v={3} />

      <Field noMargin label={t('browse-dashboards.action.move-modal-field-label', 'Folder name')}>
        <ProvisioningAwareFolderPicker
          value={moveTarget}
          excludeUIDs={selectedFolders}
          onChange={setMoveTarget}
          repositoryName={undefined} // is non-provisioned folder
        />
      </Field>

      <Modal.ButtonRow>
        <Button onClick={onDismiss} variant="secondary" fill="outline">
          <Trans i18nKey="browse-dashboards.action.cancel-button">Cancel</Trans>
        </Button>
        <Button disabled={moveTarget === undefined || isMoving} onClick={onMove} variant="primary">
          {isMoving
            ? t('browse-dashboards.action.moving', 'Moving...')
            : t('browse-dashboards.action.move-button', 'Move')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
