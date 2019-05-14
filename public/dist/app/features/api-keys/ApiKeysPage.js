import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import ReactDOMServer from 'react-dom/server';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { OrgRole } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getApiKeys, getApiKeysCount } from './state/selectors';
import { loadApiKeys, deleteApiKey, setSearchQuery, addApiKey } from './state/actions';
import Page from 'app/core/components/Page/Page';
import SlideDown from 'app/core/components/Animations/SlideDown';
import ApiKeysAddedModal from './ApiKeysAddedModal';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { DeleteButton } from '@grafana/ui';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
var ApiKeyStateProps;
(function (ApiKeyStateProps) {
    ApiKeyStateProps["Name"] = "name";
    ApiKeyStateProps["Role"] = "role";
})(ApiKeyStateProps || (ApiKeyStateProps = {}));
var initialApiKeyState = {
    name: '',
    role: OrgRole.Viewer,
};
var ApiKeysPage = /** @class */ (function (_super) {
    tslib_1.__extends(ApiKeysPage, _super);
    function ApiKeysPage(props) {
        var _this = _super.call(this, props) || this;
        _this.onSearchQueryChange = function (value) {
            _this.props.setSearchQuery(value);
        };
        _this.onToggleAdding = function () {
            _this.setState({ isAdding: !_this.state.isAdding });
        };
        _this.onAddApiKey = function (evt) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var openModal;
            return tslib_1.__generator(this, function (_a) {
                evt.preventDefault();
                openModal = function (apiKey) {
                    var rootPath = window.location.origin + config.appSubUrl;
                    var modalTemplate = ReactDOMServer.renderToString(React.createElement(ApiKeysAddedModal, { apiKey: apiKey, rootPath: rootPath }));
                    appEvents.emit('show-modal', {
                        templateHtml: modalTemplate,
                    });
                };
                this.props.addApiKey(this.state.newApiKey, openModal);
                this.setState(function (prevState) {
                    return tslib_1.__assign({}, prevState, { newApiKey: initialApiKeyState, isAdding: false });
                });
                return [2 /*return*/];
            });
        }); };
        _this.onApiKeyStateUpdate = function (evt, prop) {
            var value = evt.currentTarget.value;
            _this.setState(function (prevState) {
                var newApiKey = tslib_1.__assign({}, prevState.newApiKey);
                newApiKey[prop] = value;
                return tslib_1.__assign({}, prevState, { newApiKey: newApiKey });
            });
        };
        _this.state = { isAdding: false, newApiKey: initialApiKeyState };
        return _this;
    }
    ApiKeysPage.prototype.componentDidMount = function () {
        this.fetchApiKeys();
    };
    ApiKeysPage.prototype.fetchApiKeys = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadApiKeys()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ApiKeysPage.prototype.onDeleteApiKey = function (key) {
        this.props.deleteApiKey(key.id);
    };
    ApiKeysPage.prototype.renderEmptyList = function () {
        var isAdding = this.state.isAdding;
        return (React.createElement(React.Fragment, null,
            !isAdding && (React.createElement(EmptyListCTA, { model: {
                    title: "You haven't added any API Keys yet.",
                    buttonIcon: 'fa fa-plus',
                    buttonLink: '#',
                    onClick: this.onToggleAdding,
                    buttonTitle: ' New API Key',
                    proTip: 'Remember you can provide view-only API access to other applications.',
                    proTipLink: '',
                    proTipLinkTitle: '',
                    proTipTarget: '_blank',
                } })),
            this.renderAddApiKeyForm()));
    };
    ApiKeysPage.prototype.renderAddApiKeyForm = function () {
        var _this = this;
        var _a = this.state, newApiKey = _a.newApiKey, isAdding = _a.isAdding;
        return (React.createElement(SlideDown, { in: isAdding },
            React.createElement("div", { className: "cta-form" },
                React.createElement("button", { className: "cta-form__close btn btn-transparent", onClick: this.onToggleAdding },
                    React.createElement("i", { className: "fa fa-close" })),
                React.createElement("h5", null, "Add API Key"),
                React.createElement("form", { className: "gf-form-group", onSubmit: this.onAddApiKey },
                    React.createElement("div", { className: "gf-form-inline" },
                        React.createElement("div", { className: "gf-form max-width-21" },
                            React.createElement("span", { className: "gf-form-label" }, "Key name"),
                            React.createElement("input", { type: "text", className: "gf-form-input", value: newApiKey.name, placeholder: "Name", onChange: function (evt) { return _this.onApiKeyStateUpdate(evt, ApiKeyStateProps.Name); } })),
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("span", { className: "gf-form-label" }, "Role"),
                            React.createElement("span", { className: "gf-form-select-wrapper" },
                                React.createElement("select", { className: "gf-form-input gf-size-auto", value: newApiKey.role, onChange: function (evt) { return _this.onApiKeyStateUpdate(evt, ApiKeyStateProps.Role); } }, Object.keys(OrgRole).map(function (role) {
                                    return (React.createElement("option", { key: role, label: role, value: role }, role));
                                })))),
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("button", { className: "btn gf-form-btn btn-primary" }, "Add")))))));
    };
    ApiKeysPage.prototype.renderApiKeyList = function () {
        var _this = this;
        var isAdding = this.state.isAdding;
        var _a = this.props, apiKeys = _a.apiKeys, searchQuery = _a.searchQuery;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(FilterInput, { labelClassName: "gf-form--has-input-icon gf-form--grow", inputClassName: "gf-form-input", placeholder: "Search keys", value: searchQuery, onChange: this.onSearchQueryChange })),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                React.createElement("button", { className: "btn btn-primary pull-right", onClick: this.onToggleAdding, disabled: isAdding }, "Add API key")),
            this.renderAddApiKeyForm(),
            React.createElement("h3", { className: "page-heading" }, "Existing Keys"),
            React.createElement("table", { className: "filter-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Name"),
                        React.createElement("th", null, "Role"),
                        React.createElement("th", { style: { width: '34px' } }))),
                apiKeys.length > 0 ? (React.createElement("tbody", null, apiKeys.map(function (key) {
                    return (React.createElement("tr", { key: key.id },
                        React.createElement("td", null, key.name),
                        React.createElement("td", null, key.role),
                        React.createElement("td", null,
                            React.createElement(DeleteButton, { onConfirm: function () { return _this.onDeleteApiKey(key); } }))));
                }))) : null)));
    };
    ApiKeysPage.prototype.render = function () {
        var _a = this.props, hasFetched = _a.hasFetched, navModel = _a.navModel, apiKeysCount = _a.apiKeysCount;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: !hasFetched }, hasFetched && (apiKeysCount > 0 ? this.renderApiKeyList() : this.renderEmptyList()))));
    };
    return ApiKeysPage;
}(PureComponent));
export { ApiKeysPage };
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'apikeys'),
        apiKeys: getApiKeys(state.apiKeys),
        searchQuery: state.apiKeys.searchQuery,
        apiKeysCount: getApiKeysCount(state.apiKeys),
        hasFetched: state.apiKeys.hasFetched,
    };
}
var mapDispatchToProps = {
    loadApiKeys: loadApiKeys,
    deleteApiKey: deleteApiKey,
    setSearchQuery: setSearchQuery,
    addApiKey: addApiKey,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ApiKeysPage));
//# sourceMappingURL=ApiKeysPage.js.map