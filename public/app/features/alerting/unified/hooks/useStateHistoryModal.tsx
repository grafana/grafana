import React, { useMemo, useState } from 'react';

import { Modal } from '@grafana/ui';

import { StateHistory } from '../components/rules/StateHistory';

function useStateHistoryModal(alertId: string, oldAlertId: string) { // LOGZ.IO GRAFANA CHANGE :: DEV-31760 - Retrieve annotations for migrated unified alerts
  const [showModal, setShowModal] = useState<boolean>(false);
  // LOGZ.IO GRAFANA CHANGE :: DEV-31760 - Retrieve annotations for migrated unified alerts
  const StateHistoryModal = useMemo(
    () => (
      <Modal
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="State history"
      >
        <StateHistory alertId={alertId} oldAlertId={oldAlertId} />
      </Modal>
    ),
    [alertId, oldAlertId, showModal]
  );
  // LOGZ.IO GRAFANA CHANGE :: end
  return {
    StateHistoryModal,
    showStateHistoryModal: () => setShowModal(true),
    hideStateHistoryModal: () => setShowModal(false),
  };
}

export { useStateHistoryModal };
