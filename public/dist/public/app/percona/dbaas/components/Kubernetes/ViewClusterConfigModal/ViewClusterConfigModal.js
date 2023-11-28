import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, ClipboardButton, HorizontalGroup, useTheme } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { Messages } from '../../../DBaaS.messages';
import { KubernetesService } from '../Kubernetes.service';
import { GET_KUBERNETES_CONFIG_CANCEL_TOKEN } from './ViewClusterConfigModal.constants';
import { getStyles } from './ViewClusterConfigModal.styles';
export const ViewClusterConfigModal = ({ isVisible, setVisible, selectedCluster, }) => {
    const theme = useTheme();
    const styles = getStyles(theme);
    const [kubeconfig, setKubeconfig] = useState('');
    const [loading, setLoading] = useState(false);
    const [generateToken] = useCancelToken();
    const outputRef = useRef(null);
    const copyToClipboard = useCallback(() => {
        var _a;
        appEvents.emit(AppEvents.alertSuccess, [Messages.successfulCopyMessage]);
        return ((_a = outputRef.current) === null || _a === void 0 ? void 0 : _a.textContent) || '';
    }, [outputRef]);
    useEffect(() => {
        const getClusters = () => __awaiter(void 0, void 0, void 0, function* () {
            if (!(selectedCluster === null || selectedCluster === void 0 ? void 0 : selectedCluster.kubernetesClusterName)) {
                setVisible(false);
                return;
            }
            setLoading(true);
            try {
                const config = yield KubernetesService.getKubernetesConfig(selectedCluster, generateToken(GET_KUBERNETES_CONFIG_CANCEL_TOKEN));
                setKubeconfig(config.kube_auth.kubeconfig);
            }
            catch (e) {
                if (isApiCancelError(e)) {
                    return;
                }
                logger.error(e);
            }
            setLoading(false);
        });
        getClusters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCluster]);
    return (React.createElement(Modal, { title: "View cluster config", isVisible: isVisible, onClose: () => setVisible(false) },
        React.createElement(HorizontalGroup, { justify: "flex-start", spacing: "md" },
            React.createElement(ClipboardButton, { getText: copyToClipboard, variant: "secondary", size: "sm" }, Messages.copyToClipboard)),
        React.createElement(Overlay, { isPending: loading, className: styles.overlay },
            React.createElement("pre", { ref: (pre) => (outputRef.current = pre) }, kubeconfig)),
        React.createElement(HorizontalGroup, { justify: "flex-end", spacing: "md" },
            React.createElement(Button, { variant: "destructive", size: "md", onClick: () => setVisible(false), "data-testid": "delete-dbcluster-button" }, "Close"))));
};
//# sourceMappingURL=ViewClusterConfigModal.js.map