import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Modal } from '@grafana/ui';

import { type NestedGroupsTarget } from '../types/DashboardLayoutGroup';

export interface UngroupGroupsModalProps {
  /** When set, the tabs option is disabled and this text is shown as the tooltip */
  disabledTabsReason?: string;
  /** Warn that repeat options configured on the dissolved groups will be lost */
  showRepeatLossWarning?: boolean;
  onSelect: (target: NestedGroupsTarget) => void;
  onDismiss: () => void;
}

export function UngroupGroupsModal({
  disabledTabsReason,
  showRepeatLossWarning,
  onSelect,
  onDismiss,
}: UngroupGroupsModalProps) {
  const select = (target: NestedGroupsTarget) => {
    onSelect(target);
    onDismiss();
  };

  return (
    <Modal
      isOpen={true}
      title={t('dashboard.layout.ungroup-groups-title', 'Ungroup nested groups?')}
      onDismiss={onDismiss}
    >
      <p>
        <Trans i18nKey="dashboard.layout.ungroup-groups-text">
          Nested groups will be moved up a level and converted to rows or tabs.
        </Trans>
      </p>
      {showRepeatLossWarning && (
        <Alert
          severity="warning"
          title={t(
            'dashboard.layout.ungroup-repeat-loss',
            'Repeat options configured on the ungrouped groups will be lost.'
          )}
        />
      )}
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard.layout.cancel">Cancel</Trans>
        </Button>
        <Button icon="list-ul" variant="primary" onClick={() => select('rows')}>
          <Trans i18nKey="dashboard.layout.ungroup-convert-to-rows">Convert to rows</Trans>
        </Button>
        <Button
          icon="window"
          variant="primary"
          disabled={Boolean(disabledTabsReason)}
          tooltip={disabledTabsReason}
          onClick={() => select('tabs')}
        >
          <Trans i18nKey="dashboard.layout.ungroup-convert-to-tabs">Convert to tabs</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
