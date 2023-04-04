import React, { lazy, Suspense, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { Modal } from '@grafana/ui';

const AnnotationsStateHistory = lazy(() => import('../components/rules/StateHistory'));
const LokiStateHistory = lazy(() => import('../components/rules/LokiStateHistory'));

enum StateHistoryImplementation {
  Loki,
  Annotations,
}

function useStateHistoryModal(alertId: string) {
  const [showModal, setShowModal] = useState<boolean>(false);

  const implementation =
    config.unifiedAlerting.alertStateHistoryBackend === 'loki'
      ? StateHistoryImplementation.Loki
      : StateHistoryImplementation.Annotations;

  const StateHistoryModal = useMemo(
    () => (
      <Modal
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="State history"
      >
        <Suspense fallback={'Loading...'}>
          {implementation === StateHistoryImplementation.Loki && <LokiStateHistory ruleUID={alertId} />}
          {implementation === StateHistoryImplementation.Annotations && <AnnotationsStateHistory alertId={alertId} />}
        </Suspense>
      </Modal>
    ),
    [alertId, showModal, implementation]
  );

  return {
    StateHistoryModal,
    showStateHistoryModal: () => setShowModal(true),
    hideStateHistoryModal: () => setShowModal(false),
  };
}

export { useStateHistoryModal };
