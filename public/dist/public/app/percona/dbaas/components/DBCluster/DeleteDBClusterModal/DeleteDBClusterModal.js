import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { logger } from 'app/percona/shared/helpers/logger';
import { newDBClusterService } from '../DBCluster.utils';
import { getStyles } from './DeleteDBClusterModal.styles';
export const DeleteDBClusterModal = ({ isVisible, setVisible, setLoading, onClusterDeleted, selectedCluster, }) => {
    const styles = useStyles(getStyles);
    const deleteDBCluster = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!selectedCluster) {
            setVisible(false);
            return;
        }
        try {
            setLoading(true);
            setVisible(false);
            const dbClusterService = newDBClusterService(selectedCluster === null || selectedCluster === void 0 ? void 0 : selectedCluster.databaseType);
            yield dbClusterService.deleteDBClusters(selectedCluster);
            onClusterDeleted();
        }
        catch (e) {
            setLoading(false);
            logger.error(e);
        }
    }), [selectedCluster, onClusterDeleted, setVisible, setLoading]);
    const ConfirmationMessage = () => selectedCluster ? (React.createElement("h4", { className: styles.deleteModalContent },
        "Are you sure that you want to delete",
        ` ${DATABASE_LABELS[selectedCluster.databaseType]} `,
        "cluster",
        React.createElement("span", { className: styles.namesHighlight }, ` ${selectedCluster.clusterName} `),
        "from Kubernetes cluster",
        React.createElement("span", { className: styles.namesHighlight }, ` ${selectedCluster.kubernetesClusterName} `),
        "?")) : null;
    return (React.createElement(Modal, { title: Messages.dbcluster.deleteModal.title, isVisible: isVisible, onClose: () => setVisible(false) },
        React.createElement(ConfirmationMessage, null),
        React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
            React.createElement(Button, { variant: "secondary", size: "md", onClick: () => setVisible(false), "data-testid": "cancel-delete-dbcluster-button" }, Messages.dbcluster.deleteModal.cancel),
            React.createElement(Button, { variant: "destructive", size: "md", onClick: deleteDBCluster, "data-testid": "delete-dbcluster-button" }, Messages.dbcluster.deleteModal.confirm))));
};
//# sourceMappingURL=DeleteDBClusterModal.js.map