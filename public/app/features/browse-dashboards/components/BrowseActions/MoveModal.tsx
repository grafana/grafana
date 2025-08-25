import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, Field, Modal, Text, Space } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
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
  const provisioningEnabled = config.featureToggles.provisioning;
  const { data: settingsData } = useGetFrontendSettingsQuery(!provisioningEnabled ? skipToken : undefined);

  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
  const provisionedFolders = useMemo(() => {
    if (!settingsData) {
      return [];
    }
    return settingsData.items.map((repo) => repo.name);
  }, [settingsData]);

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

      <Text element="p">
        <Trans i18nKey="browse-dashboards.action.move-modal-text">This action will move the following content:</Trans>
      </Text>

      <DescendantCount selectedItems={selectedItems} />

      <Space v={3} />

      <Field label={t('browse-dashboards.action.move-modal-field-label', 'Folder name')}>
        <ProvisioningAwareFolderPicker
          value={moveTarget}
          excludeUIDs={[...selectedFolders, ...provisionedFolders]}
          onChange={setMoveTarget}
          isNonProvisionedFolder
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
