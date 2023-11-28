import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from 'react-use';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, InlineSwitch, Tooltip, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ReadMoreLink } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchActiveServiceTypesAction, fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { CLUSTERS_SWITCH_KEY, GET_SERVICES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import DeleteServiceModal from '../components/DeleteServiceModal';
import DeleteServicesModal from '../components/DeleteServicesModal';
import Clusters from './Services/Clusters';
import ServicesTable from './Services/ServicesTable';
import { getAgentsMonitoringStatus } from './Services.utils';
import { getStyles } from './Tabs.styles';
export const Services = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const [selected, setSelectedRows] = useState([]);
    const [actionItem, setActionItem] = useState(null);
    const navModel = usePerconaNavModel('inventory-services');
    const [generateToken] = useCancelToken();
    const dispatch = useAppDispatch();
    const { isLoading, services: fetchedServices } = useSelector(getServices);
    const styles = useStyles2(getStyles);
    const flattenServices = useMemo(() => fetchedServices.map((value) => {
        var _a, _b;
        return Object.assign(Object.assign({ type: value.type }, value.params), { cluster: value.params.cluster || ((_a = value.params.customLabels) === null || _a === void 0 ? void 0 : _a.cluster) || '', agentsStatus: getAgentsMonitoringStatus((_b = value.params.agents) !== null && _b !== void 0 ? _b : []) });
    }), [fetchedServices]);
    const [showClusters, setShowClusters] = useLocalStorage(CLUSTERS_SWITCH_KEY, false);
    const loadData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) }));
            yield dispatch(fetchActiveServiceTypesAction());
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const onAddService = useCallback(() => {
        locationService.push('/add-instance');
    }, []);
    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSelectionChange = useCallback((rows) => {
        setSelectedRows(rows);
    }, []);
    const handleDelete = useCallback((service) => {
        setActionItem(service);
        setModalVisible(true);
    }, []);
    const onModalClose = useCallback(() => {
        setModalVisible(false);
        setActionItem(null);
    }, []);
    const onDeleteSuccess = useCallback(() => {
        setSelectedRows([]);
        onModalClose();
        loadData();
    }, [onModalClose, loadData]);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, { isLoading: isLoading },
            React.createElement(FeatureLoader, null,
                React.createElement(HorizontalGroup, { height: 40, justify: "flex-end", align: "flex-start" },
                    React.createElement(HorizontalGroup, { align: "center" },
                        React.createElement(InlineSwitch, { id: "organize-by-clusters", label: Messages.services.organizeByClusters, className: styles.clustersSwitch, value: showClusters, onClick: () => setShowClusters(!showClusters), showLabel: true, transparent: true }),
                        React.createElement(Tooltip, { interactive: true, placement: "top", theme: "info", content: React.createElement(ReadMoreLink, null) },
                            React.createElement("div", { className: styles.technicalPreview },
                                React.createElement(HorizontalGroup, { align: "center", spacing: "xs" },
                                    React.createElement("span", null, Messages.services.technicalPreview),
                                    React.createElement(Icon, { name: "info-circle" }))))),
                    React.createElement(Button, { size: "md", disabled: selected.length === 0, onClick: () => {
                            setModalVisible(true);
                        }, icon: "trash-alt", variant: "destructive" }, Messages.delete),
                    React.createElement(Button, { icon: "plus", onClick: onAddService }, Messages.services.add)),
                actionItem ? (React.createElement(DeleteServiceModal, { serviceId: actionItem.serviceId, serviceName: actionItem.serviceName, isOpen: modalVisible, onCancel: onModalClose, onSuccess: onDeleteSuccess })) : (React.createElement(DeleteServicesModal, { services: selected, isOpen: modalVisible, onSuccess: onDeleteSuccess, onDismiss: onModalClose })),
                showClusters ? (React.createElement(Clusters, { services: flattenServices, onDelete: handleDelete, onSelectionChange: handleSelectionChange })) : (React.createElement(ServicesTable, { flattenServices: flattenServices, onSelectionChange: handleSelectionChange, onDelete: handleDelete, isLoading: isLoading }))))));
};
export default Services;
//# sourceMappingURL=Services.js.map