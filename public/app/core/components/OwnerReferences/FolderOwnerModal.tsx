import { t, Trans } from '@grafana/i18n';
import { Modal, Box, Stack, Text } from '@grafana/ui';

import { ManageOwnerReferences } from './ManageOwnerReferences';

export const FolderOwnerModal = ({
  onDismiss,
  onSave,
  onCancel,
  isOpen,
  resourceId,
}: {
  onDismiss: () => void;
  onSave: () => void;
  onCancel: () => void;
  isOpen: boolean;
  resourceId: string;
}) => {
  return (
    <Modal
      title={t('manage-owner-references.manage-folder-owner', 'Manage folder owner')}
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
      <Stack gap={1} direction="column">
        <Text element="p">
          <Trans i18nKey="manage-owner-references.manage-folder-owner-alert-title">
            Select a team to own this folder to help organise your resources.
          </Trans>
        </Text>
        <Text element="p">
          <Trans i18nKey="manage-owner-references.manage-folder-owner-alert-text">
            Folders owned by teams that you belong to will be prioritised for you in the folder picker and other
            locations.
          </Trans>
        </Text>
        <Box paddingTop={1}>
          <ManageOwnerReferences resourceId={resourceId} onSave={onSave} onCancel={onCancel} />
        </Box>
      </Stack>
    </Modal>
  );
};
