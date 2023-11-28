import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { useHistory, useParams } from 'react-router-dom';
import { AppEvents } from '@grafana/data';
import { Alert, Button, Modal, PageToolbar, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { useAppDispatch } from 'app/store/store';
import { Labels } from '../add-instance/components/AddRemoteInstance/FormParts';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { updateServiceAction } from '../shared/core/reducers/services';
import { logger } from '../shared/helpers/logger';
import { EDIT_INSTANCE_DOCS_LINK, FETCH_SERVICE_CANCEL_TOKEN } from './EditInstance.constants';
import { Messages } from './EditInstance.messages';
import { getStyles } from './EditInstance.styles';
import { getInitialValues, getService, toPayload } from './EditInstance.utils';
const EditInstancePage = () => {
    const history = useHistory();
    const dispatch = useAppDispatch();
    const { serviceId } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [service, setService] = useState();
    const [generateToken] = useCancelToken();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        fetchService(serviceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceId]);
    const fetchService = (serviceId) => __awaiter(void 0, void 0, void 0, function* () {
        setIsLoading(true);
        const result = yield InventoryService.getService('/service_id/' + serviceId, generateToken(FETCH_SERVICE_CANCEL_TOKEN));
        const service = getService(result);
        setService(service);
        setIsLoading(false);
    });
    const handleCancel = () => {
        history.push('/inventory/services');
    };
    const handleSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        if (!service) {
            return;
        }
        try {
            yield dispatch(updateServiceAction({
                current: service,
                serviceId: service.service_id,
                labels: {
                    cluster: values.cluster,
                    environment: values.environment,
                    replication_set: values.replication_set,
                },
                custom_labels: toPayload(values.custom_labels || ''),
            })).unwrap();
            appEvents.emit(AppEvents.alertSuccess, [
                Messages.success.title(service.service_name),
                Messages.success.description,
            ]);
            history.push('/inventory/services');
        }
        catch (error) {
            logger.error(error);
        }
    });
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };
    const handleOpenModal = (e) => {
        setIsModalOpen(true);
        e === null || e === void 0 ? void 0 : e.preventDefault();
    };
    return (React.createElement(Form, { initialValues: getInitialValues(service), onSubmit: handleSubmit, render: ({ handleSubmit, submitting, values }) => (React.createElement(React.Fragment, null,
            React.createElement(Modal, { isOpen: isModalOpen, title: Messages.formTitle((service === null || service === void 0 ? void 0 : service.service_name) || ''), onDismiss: handleCloseModal },
                React.createElement("p", null,
                    Messages.modal.description,
                    Messages.modal.details,
                    React.createElement("a", { target: "_blank", rel: "noopener noreferrer", className: styles.link, href: EDIT_INSTANCE_DOCS_LINK }, Messages.modal.detailsLink),
                    Messages.modal.dot),
                (service === null || service === void 0 ? void 0 : service.cluster) !== (values === null || values === void 0 ? void 0 : values.cluster) && (React.createElement(Alert, { title: Messages.modal.cluster.title, severity: "warning" },
                    Messages.modal.cluster.description,
                    React.createElement("a", { target: "_blank", rel: "noopener noreferrer", href: EDIT_INSTANCE_DOCS_LINK, className: styles.link }, Messages.modal.cluster.descriptionLink),
                    Messages.modal.cluster.dot)),
                React.createElement(Modal.ButtonRow, null,
                    React.createElement(Button, { onClick: handleSubmit }, Messages.modal.confirm),
                    React.createElement(Button, { variant: "secondary", onClick: handleCloseModal }, Messages.modal.cancel))),
            React.createElement(Page, null,
                React.createElement(PageToolbar, { title: Messages.title, onGoBack: handleCancel },
                    React.createElement(ToolbarButtonRow, null,
                        React.createElement(ToolbarButton, { onClick: handleCancel }, Messages.cancel),
                        React.createElement(ToolbarButton, { onClick: handleOpenModal, variant: "primary", disabled: submitting }, Messages.saveChanges))),
                React.createElement(Page.Contents, { isLoading: isLoading },
                    React.createElement("h3", null, Messages.formTitle((service === null || service === void 0 ? void 0 : service.service_name) || '')),
                    React.createElement("form", { onSubmit: handleOpenModal },
                        React.createElement(Labels, { showNodeFields: false }),
                        React.createElement("input", { type: "submit", className: styles.hidden })))))) }));
};
export default EditInstancePage;
//# sourceMappingURL=EditInstance.js.map