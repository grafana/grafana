import { useState } from 'react';

import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { OwnerReference as OwnerReferenceType } from 'app/api/clients/folder/v1beta1';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';
import { useSetOwnerReference, useGetOwnerReferences, useRemoveOwnerReferences } from './hooks';

export const ManageOwnerReferences = ({
  resourceId,
  onSave,
  onRemove,
}: {
  resourceId: string;
  onSave: () => void;
  onRemove: () => void;
}) => {
  const [ownerRef, setOwnerRef] = useState<OwnerReferenceType | null>(null);
  const { data: ownerReferences } = useGetOwnerReferences({ resourceId });
  const [trigger] = useSetOwnerReference({ resourceId });
  const [removeOwnerReference] = useRemoveOwnerReferences({ resourceId });

  const handleSaveButtonClick = () => {
    if (ownerRef) {
      trigger(ownerRef);
      setOwnerRef(null);
      onSave();
      reportInteraction('grafana_owner_reference_modal_save_button_clicked', {
        actionType: ownerReferences[0]?.uid ? 'reference changed' : 'reference set',
      });
    }
  };

  const handleRemoveButtonClick = () => {
    reportInteraction('grafana_owner_reference_modal_remove_button_clicked');
    removeOwnerReference();
    onRemove();
  };

  return (
    <Stack direction="column" gap={2}>
      <OwnerReferenceSelector
        defaultTeamUid={ownerReferences[0]?.uid}
        onChange={(ownerReference) => {
          setOwnerRef(ownerReference);
        }}
      />
      <Stack direction="row" gap={2} justifyContent="end">
        <Button variant="destructive" fill="outline" onClick={handleRemoveButtonClick}>
          <Trans i18nKey="manage-owner-references.remove-owner">Remove owner</Trans>
        </Button>
        <Button onClick={handleSaveButtonClick}>
          <Trans i18nKey="manage-owner-references.save-owner">Save owner</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};
