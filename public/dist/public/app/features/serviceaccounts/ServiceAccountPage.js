import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { getTimeZone } from '@grafana/data';
import { Button, ConfirmModal, HorizontalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { ServiceAccountPermissions } from './ServiceAccountPermissions';
import { CreateTokenModal } from './components/CreateTokenModal';
import { ServiceAccountProfile } from './components/ServiceAccountProfile';
import { ServiceAccountTokensTable } from './components/ServiceAccountTokensTable';
import { fetchACOptions } from './state/actions';
import { createServiceAccountToken, deleteServiceAccount, deleteServiceAccountToken, loadServiceAccount, loadServiceAccountTokens, updateServiceAccount, } from './state/actionsServiceAccountPage';
function mapStateToProps(state) {
    return {
        serviceAccount: state.serviceAccountProfile.serviceAccount,
        tokens: state.serviceAccountProfile.tokens,
        isLoading: state.serviceAccountProfile.isLoading,
        timezone: getTimeZone(state.user),
    };
}
const mapDispatchToProps = {
    createServiceAccountToken,
    deleteServiceAccount,
    deleteServiceAccountToken,
    loadServiceAccount,
    loadServiceAccountTokens,
    updateServiceAccount,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const ServiceAccountPageUnconnected = ({ match, serviceAccount, tokens, timezone, isLoading, createServiceAccountToken, deleteServiceAccount, deleteServiceAccountToken, loadServiceAccount, loadServiceAccountTokens, updateServiceAccount, }) => {
    const [newToken, setNewToken] = useState('');
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
    const serviceAccountId = parseInt(match.params.id, 10);
    const tokenActionsDisabled = !contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) || serviceAccount.isDisabled;
    const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);
    const canReadPermissions = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsPermissionsRead, serviceAccount);
    const pageNav = {
        text: serviceAccount.name,
        img: serviceAccount.avatarUrl,
        subTitle: 'Manage settings for an individual service account.',
    };
    useEffect(() => {
        loadServiceAccount(serviceAccountId);
        loadServiceAccountTokens(serviceAccountId);
        if (contextSrv.licensedAccessControlEnabled()) {
            fetchACOptions();
        }
    }, [loadServiceAccount, loadServiceAccountTokens, serviceAccountId]);
    const onProfileChange = (serviceAccount) => {
        updateServiceAccount(serviceAccount);
    };
    const showDeleteServiceAccountModal = (show) => () => {
        setIsDeleteModalOpen(show);
    };
    const showDisableServiceAccountModal = (show) => () => {
        setIsDisableModalOpen(show);
    };
    const handleServiceAccountDelete = () => {
        deleteServiceAccount(serviceAccount.id);
    };
    const handleServiceAccountDisable = () => {
        updateServiceAccount(Object.assign(Object.assign({}, serviceAccount), { isDisabled: true }));
        setIsDisableModalOpen(false);
    };
    const handleServiceAccountEnable = () => {
        updateServiceAccount(Object.assign(Object.assign({}, serviceAccount), { isDisabled: false }));
    };
    const onDeleteServiceAccountToken = (key) => {
        deleteServiceAccountToken(serviceAccount === null || serviceAccount === void 0 ? void 0 : serviceAccount.id, key.id);
    };
    const onCreateToken = (token) => {
        createServiceAccountToken(serviceAccount === null || serviceAccount === void 0 ? void 0 : serviceAccount.id, token, setNewToken);
    };
    const onTokenModalClose = () => {
        setIsTokenModalOpen(false);
        setNewToken('');
    };
    return (React.createElement(Page, { navId: "serviceaccounts", pageNav: pageNav },
        React.createElement(Page.Contents, { isLoading: isLoading },
            React.createElement("div", null,
                serviceAccount && (React.createElement(HorizontalGroup, { spacing: "md", height: "auto", justify: "flex-end" },
                    React.createElement(Button, { type: 'button', variant: "destructive", onClick: showDeleteServiceAccountModal(true), disabled: !contextSrv.hasPermission(AccessControlAction.ServiceAccountsDelete) }, "Delete service account"),
                    serviceAccount.isDisabled ? (React.createElement(Button, { type: 'button', variant: "secondary", onClick: handleServiceAccountEnable, disabled: !ableToWrite }, "Enable service account")) : (React.createElement(Button, { type: 'button', variant: "secondary", onClick: showDisableServiceAccountModal(true), disabled: !ableToWrite }, "Disable service account")))),
                serviceAccount && (React.createElement(ServiceAccountProfile, { serviceAccount: serviceAccount, timeZone: timezone, onChange: onProfileChange })),
                React.createElement(HorizontalGroup, { justify: "space-between", height: "auto" },
                    React.createElement("h3", null, "Tokens"),
                    React.createElement(Button, { onClick: () => setIsTokenModalOpen(true), disabled: tokenActionsDisabled }, "Add service account token")),
                tokens && (React.createElement(ServiceAccountTokensTable, { tokens: tokens, timeZone: timezone, onDelete: onDeleteServiceAccountToken, tokenActionsDisabled: tokenActionsDisabled })),
                canReadPermissions && React.createElement(ServiceAccountPermissions, { serviceAccount: serviceAccount })),
            React.createElement(ConfirmModal, { isOpen: isDeleteModalOpen, title: "Delete service account", body: "Are you sure you want to delete this service account?", confirmText: "Delete service account", onConfirm: handleServiceAccountDelete, onDismiss: showDeleteServiceAccountModal(false) }),
            React.createElement(ConfirmModal, { isOpen: isDisableModalOpen, title: "Disable service account", body: "Are you sure you want to disable this service account?", confirmText: "Disable service account", onConfirm: handleServiceAccountDisable, onDismiss: showDisableServiceAccountModal(false) }),
            React.createElement(CreateTokenModal, { isOpen: isTokenModalOpen, token: newToken, serviceAccountLogin: serviceAccount.login, onCreateToken: onCreateToken, onClose: onTokenModalClose }))));
};
export default connector(ServiceAccountPageUnconnected);
//# sourceMappingURL=ServiceAccountPage.js.map