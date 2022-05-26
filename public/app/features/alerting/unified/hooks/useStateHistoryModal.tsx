import React, { useMemo, useState } from 'react';

import { Modal } from '@grafana/ui';

import { StateHistory } from '../components/rules/StateHistory';

function useStateHistoryModal(alertId: string) {
  const [showModal, setShowModal] = useState<boolean>(false);

  const StateHistoryModal = useMemo(
    () => (
      <Modal
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="State history"
      >
        <StateHistory alertId={alertId} />
      </Modal>
    ),
    [alertId, showModal]
  );

  return {
    StateHistoryModal,
    showStateHistoryModal: () => setShowModal(true),
    hideStateHistoryModal: () => setShowModal(false),
  };
}

export { useStateHistoryModal };
