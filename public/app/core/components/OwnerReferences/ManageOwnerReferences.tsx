import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { OwnerReference as OwnerReferenceType } from 'app/api/clients/folder/v1beta1';
import { useAppNotification } from 'app/core/copy/appNotification';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';
import { useSetOwnerReference, useGetOwnerReferences, useRemoveOwnerReferences } from './hooks';

export const ManageOwnerReferences = ({
  resourceId,
  onSave,
  onCancel,
}: {
  resourceId: string;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const notify = useAppNotification();
  const [ownerRef, setOwnerRef] = useState<OwnerReferenceType | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { data: ownerReferences } = useGetOwnerReferences({ resourceId });
  const [setOwnerReference, { isLoading: isLoadingSetOwnerReference }] = useSetOwnerReference({ resourceId });
  const [removeOwnerReference, { isLoading: isLoadingRemoveOwnerReference }] = useRemoveOwnerReferences({ resourceId });

  const handleSaveButtonClick = async () => {
    reportInteraction('grafana_owner_reference_modal_save_button_clicked', {
      actionType: ownerReferences[0]?.uid ? 'reference changed' : 'reference set',
    });

    if (!ownerRef) {
      await removeOwnerReference();
      notify.success(t('manage-owner-references.folder-owner-removed', 'Folder owner removed'));
      onSave();
      return;
    }

    await setOwnerReference(ownerRef);
    notify.success(t('manage-owner-references.folder-owner-updated', 'Folder owner updated'));
    setOwnerRef(null);
    onSave();
  };

  const handleCancelButtonClick = async () => {
    onCancel();
  };

  const isLoading = isLoadingSetOwnerReference || isLoadingRemoveOwnerReference;

  return (
    <Stack direction="column" gap={2}>
      <OwnerReferenceSelector
        defaultTeamUid={ownerReferences[0]?.uid}
        onChange={(ownerReference) => {
          setIsDirty(true);
          setOwnerRef(ownerReference);
        }}
      />
      <Stack direction="row" gap={2} justifyContent="end">
        <Button variant="secondary" fill="outline" onClick={handleCancelButtonClick} disabled={isLoading}>
          <Trans i18nKey="common.cancel">Cancel</Trans>
        </Button>
        <Button onClick={handleSaveButtonClick} disabled={isLoading || !isDirty}>
          <Trans i18nKey="manage-owner-references.save-owner">Save owner</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};
