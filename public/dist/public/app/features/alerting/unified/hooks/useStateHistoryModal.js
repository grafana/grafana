import { css } from '@emotion/css';
import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { config } from '@grafana/runtime';
import { Modal, useStyles2 } from '@grafana/ui';
const AnnotationsStateHistory = lazy(() => import('../components/rules/state-history/StateHistory'));
const LokiStateHistory = lazy(() => import('../components/rules/state-history/LokiStateHistory'));
var StateHistoryImplementation;
(function (StateHistoryImplementation) {
    StateHistoryImplementation["Loki"] = "loki";
    StateHistoryImplementation["Annotations"] = "annotations";
})(StateHistoryImplementation || (StateHistoryImplementation = {}));
function useStateHistoryModal() {
    const [showModal, setShowModal] = useState(false);
    const [rule, setRule] = useState();
    const styles = useStyles2(getStyles);
    // can be "loki", "multiple" or "annotations"
    const stateHistoryBackend = config.unifiedAlerting.alertStateHistoryBackend;
    // can be "loki" or "annotations"
    const stateHistoryPrimary = config.unifiedAlerting.alertStateHistoryPrimary;
    // if "loki" is either the backend or the primary, show the new state history implementation
    const usingNewAlertStateHistory = [stateHistoryBackend, stateHistoryPrimary].some((implementation) => implementation === StateHistoryImplementation.Loki);
    const implementation = usingNewAlertStateHistory
        ? StateHistoryImplementation.Loki
        : StateHistoryImplementation.Annotations;
    const dismissModal = useCallback(() => {
        setRule(undefined);
        setShowModal(false);
    }, []);
    const openModal = useCallback((rule) => {
        setRule(rule);
        setShowModal(true);
    }, []);
    const StateHistoryModal = useMemo(() => {
        var _a;
        if (!rule) {
            return null;
        }
        return (React.createElement(Modal, { isOpen: showModal, onDismiss: dismissModal, closeOnBackdropClick: true, closeOnEscape: true, title: "State history", className: styles.modal, contentClassName: styles.modalContent },
            React.createElement(Suspense, { fallback: 'Loading...' },
                implementation === StateHistoryImplementation.Loki && React.createElement(LokiStateHistory, { ruleUID: rule.grafana_alert.uid }),
                implementation === StateHistoryImplementation.Annotations && (React.createElement(AnnotationsStateHistory, { alertId: (_a = rule.grafana_alert.id) !== null && _a !== void 0 ? _a : '' })))));
    }, [rule, showModal, dismissModal, implementation, styles]);
    return {
        StateHistoryModal,
        showStateHistoryModal: openModal,
        hideStateHistoryModal: dismissModal,
    };
}
const getStyles = (theme) => ({
    modal: css `
    width: 80%;
    height: 80%;
    min-width: 800px;
  `,
    modalContent: css `
    height: 100%;
    width: 100%;
    padding: ${theme.spacing(2)};
  `,
});
export { useStateHistoryModal };
//# sourceMappingURL=useStateHistoryModal.js.map