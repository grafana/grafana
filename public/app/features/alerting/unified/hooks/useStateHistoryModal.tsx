import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { Modal } from '@grafana/ui';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

const AnnotationsStateHistory = lazy(() => import('../components/rules/StateHistory'));
const LokiStateHistory = lazy(() => import('../components/rules/LokiStateHistory'));

enum StateHistoryImplementation {
  Loki,
  Annotations,
}

function useStateHistoryModal() {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [rule, setRule] = useState<RulerGrafanaRuleDTO | undefined>();

  const implementation =
    config.unifiedAlerting.alertStateHistoryBackend === 'loki'
      ? StateHistoryImplementation.Loki
      : StateHistoryImplementation.Annotations;

  const dismissModal = useCallback(() => {
    setRule(undefined);
    setShowModal(false);
  }, []);

  const openModal = useCallback((rule: RulerGrafanaRuleDTO) => {
    setRule(rule);
    setShowModal(true);
  }, []);

  const StateHistoryModal = useMemo(() => {
    if (!rule) {
      return null;
    }

    return (
      <Modal
        isOpen={showModal}
        onDismiss={dismissModal}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="State history"
      >
        <Suspense fallback={'Loading...'}>
          {implementation === StateHistoryImplementation.Loki && <LokiStateHistory ruleUID={rule.grafana_alert.uid} />}
          {implementation === StateHistoryImplementation.Annotations && (
            <AnnotationsStateHistory alertId={rule.grafana_alert.id ?? ''} />
          )}
        </Suspense>
      </Modal>
    );
  }, [rule, showModal, dismissModal, implementation]);

  return {
    StateHistoryModal,
    showStateHistoryModal: openModal,
    hideStateHistoryModal: dismissModal,
  };
}

export { useStateHistoryModal };
