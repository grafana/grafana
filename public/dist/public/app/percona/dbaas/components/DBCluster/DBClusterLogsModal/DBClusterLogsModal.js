import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { Button, Icon, Spinner, useStyles } from '@grafana/ui';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { logger } from 'app/percona/shared/helpers/logger';
import { DBClusterService } from '../DBCluster.service';
import { Messages } from './DBClusterLogsModal.messages';
import { getStyles } from './DBClusterLogsModal.styles';
import { toggleLogs, transformLogs } from './DBClusterLogsModal.utils';
import { PodLogs } from './PodLogs/PodLogs';
export const DBClusterLogsModal = ({ dbCluster, isVisible, setVisible }) => {
    const styles = useStyles(getStyles);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState({ pods: [] });
    const [expanded, setExpanded] = useState(false);
    const getClusterLogs = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!dbCluster) {
            return;
        }
        try {
            setLoading(true);
            setLogs(transformLogs(yield DBClusterService.getLogs(dbCluster), logs));
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setLoading(false);
        }
    });
    const toggleCollapse = () => {
        setLogs({ pods: toggleLogs(logs.pods, !expanded) });
        setExpanded((currentValue) => !currentValue);
    };
    const refresh = () => {
        getClusterLogs();
        setExpanded(false);
    };
    useEffect(() => {
        getClusterLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbCluster]);
    useEffect(() => {
        setExpanded(false);
    }, [isVisible]);
    return (React.createElement("div", { className: styles.modal },
        React.createElement(Modal, { title: Messages.title, isVisible: isVisible, onClose: () => setVisible(false) },
            React.createElement("div", { className: styles.modalWrapper }, loading ? (React.createElement("div", { "data-testid": "dbcluster-logs-loading", className: styles.spinnerWrapper },
                React.createElement(Spinner, null))) : (React.createElement(React.Fragment, null, !logs || logs.pods.length <= 0 ? (React.createElement("span", { "data-testid": "dbcluster-no-logs" }, Messages.noLogs)) : (React.createElement(React.Fragment, null,
                React.createElement("div", { "data-testid": "dbcluster-logs-actions", className: styles.header },
                    React.createElement("span", { className: styles.podsLabel }, Messages.pods),
                    React.createElement(Button, { variant: "secondary", onClick: () => toggleCollapse(), className: styles.expandButton }, expanded ? Messages.collapse : Messages.expand),
                    React.createElement(Button, { variant: "secondary", onClick: () => refresh() },
                        React.createElement(Icon, { name: "sync" }))),
                logs.pods.map((pod) => (React.createElement(PodLogs, { key: `${pod.name}${pod.isOpen}`, podLogs: pod })))))))))));
};
//# sourceMappingURL=DBClusterLogsModal.js.map