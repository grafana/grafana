import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { instalKuberneteslOperatorAction } from 'app/percona/shared/core/reducers';
import { logger } from 'app/percona/shared/helpers/logger';
import { useDispatch } from 'app/types';
import { getStyles } from './UpdateOperatorModal.styles';
const { title, confirm, cancel, buildUpdateOperatorMessage } = Messages.kubernetes.updateOperatorModal;
export const UpdateOperatorModal = ({ kubernetesClusterName, selectedOperator, isVisible, setVisible, setSelectedCluster, setOperatorToUpdate, }) => {
    const styles = useStyles(getStyles);
    const dispatch = useDispatch();
    const { operatorType, operatorTypeLabel, version, availableVersion } = selectedOperator;
    const onClose = useCallback(() => {
        setVisible(false);
        setSelectedCluster(null);
        setOperatorToUpdate(null);
    }, [setVisible, setSelectedCluster, setOperatorToUpdate]);
    const updateOperator = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            onClose();
            dispatch(instalKuberneteslOperatorAction({
                kubernetesClusterName,
                operatorType,
                availableVersion: availableVersion || '',
            }));
        }
        catch (e) {
            logger.error(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [kubernetesClusterName, selectedOperator]);
    return (React.createElement("div", { className: styles.modalWrapper },
        React.createElement(Modal, { title: title, isVisible: isVisible, onClose: onClose },
            React.createElement("h4", { "data-testid": "update-operator-message", className: styles.updateModalContent }, buildUpdateOperatorMessage(operatorTypeLabel, React.createElement("span", { className: styles.versionHighlight }, availableVersion), React.createElement("span", { className: styles.versionHighlight }, kubernetesClusterName), version)),
            React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                React.createElement(Button, { variant: "secondary", size: "md", onClick: onClose, "data-testid": "cancel-update-operator-button" }, cancel),
                React.createElement(Button, { size: "md", onClick: updateOperator, "data-testid": "confirm-update-operator-button" }, confirm)))));
};
//# sourceMappingURL=UpdateOperatorModal.js.map