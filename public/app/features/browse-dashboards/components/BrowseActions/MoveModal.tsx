import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, Modal, Text, Space, Box } from '@grafana/ui';
import { MoveActionAvailableTargetWarning } from 'app/features/provisioning/components/Shared/MoveActionAvailableTargetWarning';
import { ProvisioningAwareFolderPicker } from 'app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: (targetFolderUid: string) => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const MoveModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [moveTarget, setMoveTarget] = useState<string>();
  const [isMoving, setIsMoving] = useState(false);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

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

      <Box paddingTop={2}>
        <Text element="p">
          <Trans i18nKey="browse-dashboards.action.move-modal-text">This action will move the following content:</Trans>
        </Text>

        <DescendantCount selectedItems={selectedItems} />
      </Box>

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
