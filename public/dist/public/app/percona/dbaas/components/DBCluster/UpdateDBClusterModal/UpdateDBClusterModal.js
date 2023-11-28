import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { logger } from 'app/percona/shared/helpers/logger';
import { formatDBClusterVersionWithBuild, newDBClusterService } from '../DBCluster.utils';
import { Messages } from './UpdateDBClusterModal.messages';
import { getStyles } from './UpdateDBClusterModal.styles';
const { title, confirm, cancel, buildUpdateDatabaseMessage } = Messages;
export const UpdateDBClusterModal = ({ dbCluster, isVisible, setVisible, setLoading, onUpdateFinished, }) => {
    const styles = useStyles(getStyles);
    const { clusterName, databaseType, installedImage, availableImage } = dbCluster;
    const onClose = useCallback(() => setVisible(false), [setVisible]);
    const update = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            setLoading(true);
            onClose();
            const dbClusterService = newDBClusterService(dbCluster === null || dbCluster === void 0 ? void 0 : dbCluster.databaseType);
            yield dbClusterService.updateDBCluster(Object.assign(Object.assign({}, dbCluster), { databaseImage: availableImage }));
            onUpdateFinished();
        }
        catch (e) {
            setLoading(false);
            logger.error(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [dbCluster, onUpdateFinished]);
    return (React.createElement("div", { className: styles.modalWrapper },
        React.createElement(Modal, { title: title, isVisible: isVisible, onClose: onClose },
            React.createElement("h4", { "data-testid": "update-dbcluster-message", className: styles.updateModalContent }, buildUpdateDatabaseMessage(databaseType, React.createElement("span", { className: styles.highlight }, formatDBClusterVersionWithBuild(installedImage)), React.createElement("span", { className: styles.highlight }, formatDBClusterVersionWithBuild(availableImage)), React.createElement("span", { className: styles.highlight }, clusterName))),
            React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                React.createElement(Button, { variant: "secondary", size: "md", onClick: onClose, "data-testid": "cancel-update-dbcluster-button" }, cancel),
                React.createElement(Button, { size: "md", onClick: update, "data-testid": "confirm-update-dbcluster-button" }, confirm)))));
};
//# sourceMappingURL=UpdateDBClusterModal.js.map