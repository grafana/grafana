import { css } from '@emotion/css';

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
      title="Unsaved changes"
      onDismiss={onDismiss}
      icon="exclamation-triangle"
      className={css({
        width: '500px',
      })}
    >
      <h5>Do you want to save your changes?</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          Discard
        </Button>
        <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onSaveSuccess} />
      </Modal.ButtonRow>
    </Modal>
  );
};
