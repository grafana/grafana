import { css } from '@emotion/css';
import { ComponentProps } from 'react';

import { ConfirmModal, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';

import { alertRuleApi } from '../../../api/alertRuleApi';

type ModalProps = Pick<ComponentProps<typeof ConfirmModal>, 'isOpen' | 'onDismiss'> & {
  isOpen: boolean;
  guid?: string;
};

export const ConfirmDeletedPermanentlyModal = ({ isOpen, onDismiss, guid }: ModalProps) => {
  const title = t('alerting.deleted-rules.delete-modal.title', 'Delete permanently an alert rule');
  const confirmText = t('alerting.deleted-rules.delete-modal.confirm', 'Yes, delete permanently');
  const [remove] = alertRuleApi.endpoints.permanentlyDeleteRule.useMutation();
  const appNotification = useAppNotification();

  const styles = useStyles2(getStyles);

  async function ondDeleteConfirm() {
    if (!guid) {
      return;
    }
    return remove({ guid })
      .then(() => {
        onDismiss();
        appNotification.success(t('alerting.deleted-rules.delete-modal.success', 'Alert rule deleted permanently'));
      })
      .catch((err) => {
        appNotification.error(
          t('alerting.deleted-rules.delete-modal.error', 'Could not delete alert rule permanently')
        );
      });
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      confirmText={confirmText}
      modalClass={styles.modal}
      confirmButtonVariant={'destructive'}
      body={
        <Stack direction="column" gap={2}>
          <Trans i18nKey="alerting.deleted-rules.delete-modal.body">
            Are you sure you want to delete permanently this alert rule? This action cannot be undone.
          </Trans>
        </Stack>
      }
      onConfirm={ondDeleteConfirm}
      onDismiss={onDismiss}
    />
  );
};

const getStyles = () => ({
  modal: css({
    width: '700px',
  }),
});
