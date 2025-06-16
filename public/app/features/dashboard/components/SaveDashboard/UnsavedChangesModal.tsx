import { css } from '@emotion/css';

import { Trans, t } from '@grafana/i18n';
import { Button, Modal } from '@grafana/ui';

import { DashboardModel } from '../../state/DashboardModel';

import { SaveDashboardButton } from './SaveDashboardButton';

interface UnsavedChangesModalProps {
  dashboard: DashboardModel;
  onDiscard: () => void;
  onDismiss: () => void;
  onSaveSuccess?: () => void;
}

export const UnsavedChangesModal = ({ dashboard, onSaveSuccess, onDiscard, onDismiss }: UnsavedChangesModalProps) => {
  return (
    <Modal
      isOpen={true}
      title={t('dashboard.unsaved-changes-modal.title-unsaved-changes', 'Unsaved changes')}
      onDismiss={onDismiss}
      icon="exclamation-triangle"
      className={css({
        width: '500px',
      })}
    >
      <h5>
        <Trans i18nKey="dashboard.unsaved-changes-modal.changes">Do you want to save your changes?</Trans>
      </h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="dashboard.unsaved-changes-modal.cancel">Cancel</Trans>
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          <Trans i18nKey="dashboard.unsaved-changes-modal.discard">Discard</Trans>
        </Button>
        <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onSaveSuccess} />
      </Modal.ButtonRow>
    </Modal>
  );
};
