import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { ConfirmModal, FilterInput, LinkButton, RadioButtonGroup, useStyles2, InlineField } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, ServiceAccountStateFilter } from 'app/types';
import { CreateTokenModal } from './components/CreateTokenModal';
import ServiceAccountListItem from './components/ServiceAccountsListItem';
import { changeQuery, fetchACOptions, fetchServiceAccounts, deleteServiceAccount, updateServiceAccount, changeStateFilter, createServiceAccountToken, } from './state/actions';
function mapStateToProps(state) {
    return Object.assign({}, state.serviceAccounts);
}
const mapDispatchToProps = {
    changeQuery,
    fetchACOptions,
    fetchServiceAccounts,
    deleteServiceAccount,
    updateServiceAccount,
    changeStateFilter,
    createServiceAccountToken,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const ServiceAccountsListPageUnconnected = ({ serviceAccounts, isLoading, roleOptions, query, serviceAccountStateFilter, changeQuery, fetchACOptions, fetchServiceAccounts, deleteServiceAccount, updateServiceAccount, changeStateFilter, createServiceAccountToken, }) => {
    const styles = useStyles2(getStyles);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
    const [newToken, setNewToken] = useState('');
    const [currentServiceAccount, setCurrentServiceAccount] = useState(null);
    useEffect(() => {
        fetchServiceAccounts({ withLoadingIndicator: true });
        if (contextSrv.licensedAccessControlEnabled()) {
            fetchACOptions();
        }
    }, [fetchACOptions, fetchServiceAccounts]);
    const noServiceAccountsCreated = serviceAccounts.length === 0 && serviceAccountStateFilter === ServiceAccountStateFilter.All && !query;
    const onRoleChange = (role, serviceAccount) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedServiceAccount = Object.assign(Object.assign({}, serviceAccount), { role: role });
        updateServiceAccount(updatedServiceAccount);
        if (contextSrv.licensedAccessControlEnabled()) {
            fetchACOptions();
        }
    });
    const onQueryChange = (value) => {
        changeQuery(value);
    };
    const onStateFilterChange = (value) => {
        changeStateFilter(value);
    };
    const onRemoveButtonClick = (serviceAccount) => {
        setCurrentServiceAccount(serviceAccount);
        setIsRemoveModalOpen(true);
    };
    const onServiceAccountRemove = () => __awaiter(void 0, void 0, void 0, function* () {
        if (currentServiceAccount) {
            deleteServiceAccount(currentServiceAccount.id);
        }
        onRemoveModalClose();
    });
    const onDisableButtonClick = (serviceAccount) => {
        setCurrentServiceAccount(serviceAccount);
        setIsDisableModalOpen(true);
    };
    const onDisable = () => {
        if (currentServiceAccount) {
            updateServiceAccount(Object.assign(Object.assign({}, currentServiceAccount), { isDisabled: true }));
        }
        onDisableModalClose();
    };
    const onEnable = (serviceAccount) => {
        updateServiceAccount(Object.assign(Object.assign({}, serviceAccount), { isDisabled: false }));
    };
    const onTokenAdd = (serviceAccount) => {
        setCurrentServiceAccount(serviceAccount);
        setIsAddModalOpen(true);
    };
    const onTokenCreate = (token) => __awaiter(void 0, void 0, void 0, function* () {
        if (currentServiceAccount) {
            createServiceAccountToken(currentServiceAccount.id, token, setNewToken);
        }
    });
    const onAddModalClose = () => {
        setIsAddModalOpen(false);
        setCurrentServiceAccount(null);
        setNewToken('');
    };
    const onRemoveModalClose = () => {
        setIsRemoveModalOpen(false);
        setCurrentServiceAccount(null);
    };
    const onDisableModalClose = () => {
        setIsDisableModalOpen(false);
        setCurrentServiceAccount(null);
    };
    const docsLink = (React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/latest/administration/service-accounts/", target: "_blank", rel: "noopener noreferrer" }, "documentation."));
    const subTitle = (React.createElement("span", null,
        "Service accounts and their tokens can be used to authenticate against the Grafana API. Find out more in our",
        ' ',
        docsLink));
    return (React.createElement(Page, { navId: "serviceaccounts", subTitle: subTitle },
        React.createElement(Page.Contents, null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement(InlineField, { grow: true },
                    React.createElement(FilterInput, { placeholder: "Search service account by name", value: query, onChange: onQueryChange, width: 50 })),
                React.createElement(RadioButtonGroup, { options: [
                        { label: 'All', value: ServiceAccountStateFilter.All },
                        { label: 'With expired tokens', value: ServiceAccountStateFilter.WithExpiredTokens },
                        { label: 'Disabled', value: ServiceAccountStateFilter.Disabled },
                    ], onChange: onStateFilterChange, value: serviceAccountStateFilter, className: styles.filter }),
                !noServiceAccountsCreated && contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate) && (React.createElement(LinkButton, { href: "org/serviceaccounts/create", variant: "primary" }, "Add service account"))),
            isLoading && React.createElement(PageLoader, null),
            !isLoading && noServiceAccountsCreated && (React.createElement(React.Fragment, null,
                React.createElement(EmptyListCTA, { title: "You haven't created any service accounts yet.", buttonIcon: "key-skeleton-alt", buttonLink: "org/serviceaccounts/create", buttonTitle: "Add service account", buttonDisabled: !contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate), proTip: "Remember, you can provide specific permissions for API access to other applications.", proTipLink: "", proTipLinkTitle: "", proTipTarget: "_blank" }))),
            !isLoading && serviceAccounts.length !== 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: cx(styles.table, 'admin-list-table') },
                    React.createElement("table", { className: "filter-table filter-table--hover" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null),
                                React.createElement("th", null, "Account"),
                                React.createElement("th", null, "ID"),
                                React.createElement("th", null, "Roles"),
                                React.createElement("th", null, "Tokens"),
                                React.createElement("th", { style: { width: '34px' } }))),
                        React.createElement("tbody", null, serviceAccounts.map((serviceAccount) => (React.createElement(ServiceAccountListItem, { serviceAccount: serviceAccount, key: serviceAccount.id, roleOptions: roleOptions, onRoleChange: onRoleChange, onRemoveButtonClick: onRemoveButtonClick, onDisable: onDisableButtonClick, onEnable: onEnable, onAddTokenClick: onTokenAdd })))))))),
            currentServiceAccount && (React.createElement(React.Fragment, null,
                React.createElement(ConfirmModal, { isOpen: isRemoveModalOpen, body: `Are you sure you want to delete '${currentServiceAccount.name}'${!!currentServiceAccount.tokens
                        ? ` and ${currentServiceAccount.tokens} accompanying ${pluralize('token', currentServiceAccount.tokens)}`
                        : ''}?`, confirmText: "Delete", title: "Delete service account", onConfirm: onServiceAccountRemove, onDismiss: onRemoveModalClose }),
                React.createElement(ConfirmModal, { isOpen: isDisableModalOpen, title: "Disable service account", body: `Are you sure you want to disable '${currentServiceAccount.name}'?`, confirmText: "Disable service account", onConfirm: onDisable, onDismiss: onDisableModalClose }),
                React.createElement(CreateTokenModal, { isOpen: isAddModalOpen, token: newToken, serviceAccountLogin: currentServiceAccount.login, onCreateToken: onTokenCreate, onClose: onAddModalClose }))))));
};
export const getStyles = (theme) => {
    return {
        table: css `
      margin-top: ${theme.spacing(3)};
    `,
        filter: css `
      margin: 0 ${theme.spacing(1)};
    `,
        row: css `
      display: flex;
      align-items: center;
      height: 100% !important;

      a {
        padding: ${theme.spacing(0.5)} 0 !important;
      }
    `,
        unitTooltip: css `
      display: flex;
      flex-direction: column;
    `,
        unitItem: css `
      cursor: pointer;
      padding: ${theme.spacing(0.5)} 0;
      margin-right: ${theme.spacing(1)};
    `,
        disabled: css `
      color: ${theme.colors.text.disabled};
    `,
        link: css `
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
    `,
        pageHeader: css `
      display: flex;
      margin-bottom: ${theme.spacing(2)};
    `,
        apiKeyInfoLabel: css `
      margin-left: ${theme.spacing(1)};
      line-height: 2.2;
      flex-grow: 1;
      color: ${theme.colors.text.secondary};

      span {
        padding: ${theme.spacing(0.5)};
      }
    `,
        filterDelimiter: css `
      flex-grow: 1;
    `,
    };
};
const ServiceAccountsListPage = connector(ServiceAccountsListPageUnconnected);
export default ServiceAccountsListPage;
//# sourceMappingURL=ServiceAccountsListPage.js.map