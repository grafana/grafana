import React, { useMemo, useState } from 'react';
import { Modal } from '@grafana/ui';
import { RuleStateHistory } from '../components/rules/RuleStateHistory';

function useAlertHistoryModal(alertId: string) {
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const AlertHistoryModal = useMemo(
    () => (
      <Modal
        isOpen={showHistoryModal}
        onDismiss={() => setShowHistoryModal(false)}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="State history"
      >
        <RuleStateHistory alertId={alertId} />
      </Modal>
    ),
    [alertId, showHistoryModal]
  );

  return {
    AlertHistoryModal,
    showAlertHistoryModal: () => setShowHistoryModal(true),
    hideAlertHistoryModal: () => setShowHistoryModal(false),
  };
}

export { useAlertHistoryModal };
