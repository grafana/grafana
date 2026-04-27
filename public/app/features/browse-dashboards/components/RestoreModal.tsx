import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Space, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { getStatusFromError } from 'app/core/utils/errors';

import { FolderPicker } from '../../../core/components/Select/FolderPicker';
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
  isFetching: boolean,
  errorStatus?: number
): string | undefined {
  if (originCandidate === '') {
    return '';
  }

  if (!originCandidate || isFetching) {
    return undefined;
  }

  // Non-404 errors (e.g. 403) preserve selection — folder likely exists
  return errorStatus === 404 ? undefined : originCandidate;
}

export const RestoreModal = ({
  onConfirm,
  onDismiss,
  selectedDashboards,
  originCandidate,
  isLoading,
}: RestoreModalProps) => {
  const styles = useStyles2(getStyles);
  const [userTarget, setUserTarget] = useState<string | undefined>();
  const numberOfDashboards = selectedDashboards.length;
  const { error: originError, isFetching } = useGetFolderQuery(
    originCandidate
      ? {
          folderUID: originCandidate,
          accesscontrol: false,
          isLegacyCall: Boolean(config.featureToggles.foldersAppPlatformAPI),
        }
      : skipToken,
    { refetchOnMountOrArgChange: true }
  );
  const autoTarget = getAutoTarget(originCandidate, isFetching, getStatusFromError(originError));
  const restoreTarget = userTarget ?? autoTarget;

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
          <div className={styles.field}>
            <FolderPicker onChange={setUserTarget} value={restoreTarget} />
          </div>
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    field: css({
      fontSize: theme.typography.body.fontSize,
    }),
  };
};
