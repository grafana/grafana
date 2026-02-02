import { css } from '@emotion/css';

import { Button, Modal } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

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
      // BMC Change: Next line
      title={t('bmcgrafana.dashboards.unsaved-modal.title', 'Unsaved changes')}
      onDismiss={onDismiss}
      icon="exclamation-triangle"
      className={css({
        width: '500px',
      })}
    >
      <h5>
        {/* BMC Change: Next line */}
        <Trans i18nKey={'bmcgrafana.dashboards.unsaved-modal.confirmation-text'}>
          Do you want to save your changes?
        </Trans>
      </h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          {/* BMC Change: Next line */}
          <Trans i18nKey={'browse-dashboards.action.cancel-button'}>Cancel</Trans>
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          {/* BMC Change: Next line */}
          <Trans i18nKey={'bmcgrafana.dashboards.unsaved-modal.discard'}>Discard</Trans>
        </Button>
        <SaveDashboardButton dashboard={dashboard} onSaveSuccess={onSaveSuccess} />
      </Modal.ButtonRow>
    </Modal>
  );
};
