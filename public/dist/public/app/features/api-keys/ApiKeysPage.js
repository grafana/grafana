import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
// Utils
import { InlineField, InlineSwitch, VerticalGroup, Modal, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { WarningBlock } from 'app/percona/shared/components/Elements/WarningBlock';
import { AccessControlAction } from 'app/types';
import { Messages } from './ApiKeys.messages';
import { getStyles } from './ApiKeys.styles';
import { ApiKeysActionBar } from './ApiKeysActionBar';
import { ApiKeysTable } from './ApiKeysTable';
import { MigrateToServiceAccountsCard } from './MigrateToServiceAccountsCard';
import { deleteApiKey, migrateApiKey, migrateAll, loadApiKeys, toggleIncludeExpired } from './state/actions';
import { setSearchQuery } from './state/reducers';
import { getApiKeys, getApiKeysCount, getIncludeExpired, getIncludeExpiredDisabled } from './state/selectors';
function mapStateToProps(state) {
    const canCreate = contextSrv.hasPermission(AccessControlAction.ActionAPIKeysCreate);
    return {
        apiKeys: getApiKeys(state.apiKeys),
        searchQuery: state.apiKeys.searchQuery,
        apiKeysCount: getApiKeysCount(state.apiKeys),
        hasFetched: state.apiKeys.hasFetched,
        timeZone: getTimeZone(state.user),
        includeExpired: getIncludeExpired(state.apiKeys),
        includeExpiredDisabled: getIncludeExpiredDisabled(state.apiKeys),
        canCreate: canCreate,
        migrationResult: state.apiKeys.migrationResult,
    };
}
const defaultPageProps = {
    navId: 'apikeys',
};
const mapDispatchToProps = {
    loadApiKeys,
    deleteApiKey,
    migrateApiKey,
    migrateAll,
    setSearchQuery,
    toggleIncludeExpired,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class ApiKeysPageUnconnected extends PureComponent {
    constructor(props) {
        super(props);
        this.onDeleteApiKey = (key) => {
            this.props.deleteApiKey(key.id);
        };
        this.onMigrateApiKey = (key) => {
            this.props.migrateApiKey(key.id);
        };
        this.onSearchQueryChange = (value) => {
            this.props.setSearchQuery(value);
        };
        this.onIncludeExpiredChange = (event) => {
            this.props.toggleIncludeExpired();
        };
        this.onMigrateApiKeys = () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.props.migrateAll();
                this.setState({
                    showMigrationResult: true,
                });
            }
            catch (err) {
                console.error(err);
            }
        });
        this.dismissModal = () => __awaiter(this, void 0, void 0, function* () {
            this.setState({ showMigrationResult: false });
        });
        this.state = {
            showMigrationResult: false,
        };
    }
    componentDidMount() {
        this.fetchApiKeys();
    }
    fetchApiKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.props.loadApiKeys();
        });
    }
    render() {
        const { hasFetched, apiKeysCount, apiKeys, searchQuery, timeZone, includeExpired, includeExpiredDisabled, canCreate, migrationResult, } = this.props;
        const styles = getStyles(config.theme);
        if (!hasFetched) {
            return (React.createElement(Page, Object.assign({}, defaultPageProps),
                React.createElement(Page.Contents, { isLoading: true })));
        }
        const showTable = apiKeysCount > 0;
        return (React.createElement(Page, Object.assign({}, defaultPageProps),
            React.createElement(Page.Contents, { isLoading: false },
                React.createElement(React.Fragment, null,
                    React.createElement(MigrateToServiceAccountsCard, { onMigrate: this.onMigrateApiKeys, apikeysCount: apiKeysCount }),
                    showTable ? (React.createElement(ApiKeysActionBar, { searchQuery: searchQuery, disabled: !canCreate, onSearchChange: this.onSearchQueryChange })) : null,
                    showTable ? (React.createElement(VerticalGroup, null,
                        React.createElement(InlineField, { disabled: includeExpiredDisabled, label: "Include expired keys" },
                            React.createElement(InlineSwitch, { id: "showExpired", value: includeExpired, onChange: this.onIncludeExpiredChange })),
                        React.createElement(WarningBlock, { className: styles.deleteWarning, message: Messages.apiKeysDeleteWarning, type: "warning" }),
                        React.createElement(ApiKeysTable, { apiKeys: apiKeys, timeZone: timeZone, onMigrate: this.onMigrateApiKey, onDelete: this.onDeleteApiKey }))) : null)),
            migrationResult && (React.createElement(MigrationSummary, { visible: this.state.showMigrationResult, data: migrationResult, onDismiss: this.dismissModal }))));
    }
}
const styles = {
    migrationSummary: {
        padding: '20px',
    },
    infoText: {
        color: '#007bff',
    },
    summaryDetails: {
        marginTop: '20px',
    },
    summaryParagraph: {
        margin: '10px 0',
    },
};
export const MigrationSummary = ({ visible, data, onDismiss }) => {
    return (React.createElement(Modal, { title: "Migration summary", isOpen: visible, closeOnBackdropClick: true, onDismiss: onDismiss },
        data.failedApikeyIDs.length === 0 && (React.createElement("div", { style: styles.migrationSummary },
            React.createElement("p", null, "Migration Successful!"),
            React.createElement("p", null,
                React.createElement("strong", null, "Total: "),
                data.total),
            React.createElement("p", null,
                React.createElement("strong", null, "Migrated: "),
                data.migrated))),
        data.failedApikeyIDs.length !== 0 && (React.createElement("div", { style: styles.migrationSummary },
            React.createElement("p", null, "Migration Complete! Please note, while there might be a few API keys flagged as `failed migrations`, rest assured, all of your API keys are fully functional and operational. Please try again or contact support."),
            React.createElement("hr", null),
            React.createElement("p", null,
                React.createElement("strong", null, "Total: "),
                data.total),
            React.createElement("p", null,
                React.createElement("strong", null, "Migrated: "),
                data.migrated),
            React.createElement("p", null,
                React.createElement("strong", null, "Failed: "),
                data.failed),
            React.createElement("p", null,
                React.createElement("strong", null, "Failed Api Key IDs: "),
                data.failedApikeyIDs.join(', ')),
            React.createElement("p", null,
                React.createElement("strong", null, "Failed Details: "),
                data.failedDetails.join(', ')))),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss }, "Close"))));
};
const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
//# sourceMappingURL=ApiKeysPage.js.map