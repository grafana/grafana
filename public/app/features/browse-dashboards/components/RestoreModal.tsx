import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Field, Space, Text } from '@grafana/ui';
import { getStatusFromError } from 'app/core/utils/errors';

import { FolderPicker } from '../../../core/components/Select/FolderPicker';
import { deletedFoldersState } from '../../search/service/deletedFoldersState';
import { useGetFolderQuery } from '../api/browseDashboardsAPI';

export interface RestoreModalProps {
  onConfirm: (restoreTarget: string) => Promise<void>;
  onDismiss: () => void;
  selectedDashboards: string[];
  originCandidate?: string;
  isLoading: boolean;
}

// Derive the initial restore target before the user overrides it.
function getAutoTarget(
  originCandidate: string | undefined,
  shouldValidateOrigin: boolean,
  isOriginValidationFetching: boolean,
  originValidationStatus?: number
) {
  if (originCandidate === '') {
    return '';
  }

  if (!shouldValidateOrigin || isOriginValidationFetching) {
    return undefined;
  }

  return originValidationStatus === 404 ? undefined : originCandidate;
}

export const RestoreModal = ({
  onConfirm,
  onDismiss,
  selectedDashboards,
  originCandidate,
  isLoading,
}: RestoreModalProps) => {
  const [manualTarget, setManualTarget] = useState<string | undefined | null>(null);
  const numberOfDashboards = selectedDashboards.length;
  const originWasDeleted = deletedFoldersState.isDeleted(originCandidate);
  const shouldValidateOrigin = originCandidate !== undefined && originCandidate !== '' && !originWasDeleted;
  const { error: originValidationError, isFetching: isOriginValidationFetching } = useGetFolderQuery(
    shouldValidateOrigin
      ? {
          folderUID: originCandidate,
          accesscontrol: true,
          isLegacyCall: Boolean(config.featureToggles.foldersAppPlatformAPI),
        }
      : skipToken,
    { refetchOnMountOrArgChange: true }
  );
  const originValidationStatus = getStatusFromError(originValidationError);
  const autoTarget = getAutoTarget(
    originCandidate,
    shouldValidateOrigin,
    isOriginValidationFetching,
    originValidationStatus
  );
  const restoreTarget = manualTarget === null ? autoTarget : manualTarget;

  const onTargetChange = useCallback((folderUID: string | undefined) => {
    setManualTarget(folderUID);
  }, []);

  const onRestore = async () => {
    reportInteraction('grafana_restore_confirm_clicked', {
      item_counts: {
        dashboard: numberOfDashboards,
      },
    });
    if (restoreTarget !== undefined) {
      await onConfirm(restoreTarget);
      onDismiss();
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans i18nKey="recently-deleted.restore-modal.text" count={numberOfDashboards}>
              This action will restore {{ numberOfDashboards }} dashboards.
            </Trans>
          </Text>
          <Space v={3} />
          <Text element="p">
            <Trans i18nKey="recently-deleted.restore-modal.folder-picker-text" count={numberOfDashboards}>
              Please choose a folder where your dashboards will be restored.
            </Trans>
          </Text>
          <Space v={1} />
          {/* Field wrapper resets font-size to 14px, preventing cascade from parent Text components */}
          <Field noMargin>
            <FolderPicker onChange={onTargetChange} value={restoreTarget} />
          </Field>
        </>
      }
      confirmText={
        isLoading
          ? t('recently-deleted.restore-modal.restore-loading', 'Restoring...')
          : t('recently-deleted.restore-modal.restore-button', 'Restore')
      }
      confirmButtonVariant="primary"
      isOpen
      onDismiss={onDismiss}
      onConfirm={onRestore}
      title={t('recently-deleted.restore-modal.title', 'Restore Dashboards')}
      disabled={restoreTarget === undefined || isLoading}
    />
  );
};
