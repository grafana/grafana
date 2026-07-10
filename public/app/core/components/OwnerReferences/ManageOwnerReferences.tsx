import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Stack } from '@grafana/ui';
import { type OwnerReference as OwnerReferenceType } from 'app/api/clients/folder/v1beta1';
import { extractErrorMessage } from 'app/api/utils';
import { useAppNotification } from 'app/core/copy/appNotification';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';
import { useGetOwnerReferences, useSetOwnerReferences } from './hooks';

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
  const [desiredTeamRefs, setDesiredTeamRefs] = useState<OwnerReferenceType[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { data: ownerReferences } = useGetOwnerReferences({ resourceId });
  const [setOwnerReferences, { isLoading }] = useSetOwnerReferences({ resourceId });
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  // Non-team owner references are preserved untouched; this modal only manages team owners.
  const nonTeamOwnerRefs = useMemo(() => ownerReferences.filter((ref) => ref.kind !== 'Team'), [ownerReferences]);
  const defaultTeamUids = useMemo(
    () => ownerReferences.filter((ref) => ref.kind === 'Team').map((ref) => ref.uid),
    [ownerReferences]
  );

  const handleSaveButtonClick = async () => {
    try {
      const teamRefs = desiredTeamRefs ?? [];
      reportInteraction('grafana_owner_reference_modal_save_button_clicked', {
        actionType: teamRefs.length > 0 ? 'reference changed' : 'reference set',
        ownerCount: teamRefs.length,
      });

      await setOwnerReferences([...nonTeamOwnerRefs, ...teamRefs]).unwrap();
      notify.success(
        teamRefs.length > 0
          ? t('manage-owner-references.folder-owners-updated', 'Folder owners updated')
          : t('manage-owner-references.folder-owners-removed', 'Folder owners removed')
      );
      setDesiredTeamRefs(null);
      onSave();
    } catch (error) {
      const errorMessage = extractErrorMessage(error, t('manage-owner-references.unknown-error', 'Unknown error'));
      setApiErrorMessage(errorMessage);
      notify.error(t('manage-owner-references.folder-owner-error', 'Error updating folder owners'));
    }
  };

  const handleCancelButtonClick = async () => {
    onCancel();
  };

  return (
    <Stack direction="column" gap={2}>
      <OwnerReferenceSelector
        defaultTeamUids={defaultTeamUids}
        onChange={(ownerRefs) => {
          setIsDirty(true);
          setDesiredTeamRefs(ownerRefs);
        }}
      />
      {apiErrorMessage && (
        <Alert severity="error" title={t('manage-owner-references.folder-owner-error', 'Error updating folder owners')}>
          {apiErrorMessage}
        </Alert>
      )}
      <Stack direction="row" gap={2} justifyContent="end">
        <Button variant="secondary" fill="outline" onClick={handleCancelButtonClick} disabled={isLoading}>
          <Trans i18nKey="common.cancel">Cancel</Trans>
        </Button>
        <Button onClick={handleSaveButtonClick} disabled={isLoading || !isDirty}>
          <Trans i18nKey="manage-owner-references.save-owner">Save owners</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};
