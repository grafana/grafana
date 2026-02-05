import { useState } from 'react';

import { Trans } from '@grafana/i18n';
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
  const [pendingReference, setPendingReference] = useState<OwnerReferenceType | null>(null);
  const { data: ownerReferences } = useGetOwnerReferences({ resourceId });
  const [trigger] = useSetOwnerReference({ resourceId });
  const [removeOwnerReference] = useRemoveOwnerReferences({ resourceId });

  const addOwnerReference = (ownerReference: OwnerReferenceType) => {
    trigger(ownerReference);
  };

  return (
    <Stack direction="column" gap={2}>
      <OwnerReferenceSelector
        defaultTeamUid={ownerReferences[0]?.uid}
        onChange={(ownerReference) => {
          setPendingReference(ownerReference);
        }}
      />
      <Stack direction="row" gap={2} justifyContent="end">
        <Button
          variant="destructive"
          fill="outline"
          onClick={() => {
            removeOwnerReference();
            onRemove();
          }}
        >
          <Trans i18nKey="manage-owner-references.remove-owner">Remove owner</Trans>
        </Button>
        <Button
          onClick={() => {
            if (pendingReference) {
              addOwnerReference(pendingReference);
              setPendingReference(null);
              onSave();
            }
          }}
        >
          <Trans i18nKey="manage-owner-references.save-owner">Save owner</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};
