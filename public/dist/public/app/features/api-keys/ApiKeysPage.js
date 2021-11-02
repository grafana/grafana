import { __assign, __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import { getApiKeys, getApiKeysCount } from './state/selectors';
import { addApiKey, deleteApiKey, loadApiKeys } from './state/actions';
import Page from 'app/core/components/Page/Page';
import { ApiKeysAddedModal } from './ApiKeysAddedModal';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { InlineField, InlineSwitch, VerticalGroup } from '@grafana/ui';
import { rangeUtil } from '@grafana/data';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { setSearchQuery } from './state/reducers';
import { ApiKeysForm } from './ApiKeysForm';
import { ApiKeysActionBar } from './ApiKeysActionBar';
import { ApiKeysTable } from './ApiKeysTable';
import { ApiKeysController } from './ApiKeysController';
import { ShowModalReactEvent } from 'app/types/events';
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'apikeys'),
        apiKeys: getApiKeys(state.apiKeys),
        searchQuery: state.apiKeys.searchQuery,
        apiKeysCount: getApiKeysCount(state.apiKeys),
        hasFetched: state.apiKeys.hasFetched,
        timeZone: getTimeZone(state.user),
    };
}
var mapDispatchToProps = {
    loadApiKeys: loadApiKeys,
    deleteApiKey: deleteApiKey,
    setSearchQuery: setSearchQuery,
    addApiKey: addApiKey,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var ApiKeysPageUnconnected = /** @class */ (function (_super) {
    __extends(ApiKeysPageUnconnected, _super);
    function ApiKeysPageUnconnected(props) {
        var _this = _super.call(this, props) || this;
        _this.onDeleteApiKey = function (key) {
            _this.props.deleteApiKey(key.id, _this.state.includeExpired);
        };
        _this.onSearchQueryChange = function (value) {
            _this.props.setSearchQuery(value);
        };
        _this.onIncludeExpiredChange = function (event) {
            _this.setState({ hasFetched: false, includeExpired: event.currentTarget.checked }, _this.fetchApiKeys);
        };
        _this.onAddApiKey = function (newApiKey) {
            var openModal = function (apiKey) {
                var rootPath = window.location.origin + config.appSubUrl;
                appEvents.publish(new ShowModalReactEvent({
                    props: {
                        apiKey: apiKey,
                        rootPath: rootPath,
                    },
                    component: ApiKeysAddedModal,
                }));
            };
            var secondsToLive = newApiKey.secondsToLive;
            try {
                var secondsToLiveAsNumber = secondsToLive ? rangeUtil.intervalToSeconds(secondsToLive) : null;
                var apiKey = __assign(__assign({}, newApiKey), { secondsToLive: secondsToLiveAsNumber });
                _this.props.addApiKey(apiKey, openModal, _this.state.includeExpired);
                _this.setState(function (prevState) {
                    return __assign(__assign({}, prevState), { isAdding: false });
                });
            }
            catch (err) {
                console.error(err);
            }
        };
        _this.state = { includeExpired: false, hasFetched: false };
        return _this;
    }
    ApiKeysPageUnconnected.prototype.componentDidMount = function () {
        this.fetchApiKeys();
    };
    ApiKeysPageUnconnected.prototype.fetchApiKeys = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadApiKeys(this.state.includeExpired)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ApiKeysPageUnconnected.prototype.render = function () {
        var _this = this;
        var _a = this.props, hasFetched = _a.hasFetched, navModel = _a.navModel, apiKeysCount = _a.apiKeysCount, apiKeys = _a.apiKeys, searchQuery = _a.searchQuery, timeZone = _a.timeZone;
        var includeExpired = this.state.includeExpired;
        if (!hasFetched) {
            return (React.createElement(Page, { navModel: navModel },
                React.createElement(Page.Contents, { isLoading: true })));
        }
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: false },
                React.createElement(ApiKeysController, null, function (_a) {
                    var isAdding = _a.isAdding, toggleIsAdding = _a.toggleIsAdding;
                    var showCTA = !isAdding && apiKeysCount === 0;
                    var showTable = apiKeysCount > 0;
                    return (React.createElement(React.Fragment, null,
                        showCTA ? (React.createElement(EmptyListCTA, { title: "You haven't added any API keys yet.", buttonIcon: "key-skeleton-alt", onClick: toggleIsAdding, buttonTitle: "New API key", proTip: "Remember, you can provide view-only API access to other applications." })) : null,
                        showTable ? (React.createElement(ApiKeysActionBar, { searchQuery: searchQuery, disabled: isAdding, onAddClick: toggleIsAdding, onSearchChange: _this.onSearchQueryChange })) : null,
                        React.createElement(ApiKeysForm, { show: isAdding, onClose: toggleIsAdding, onKeyAdded: _this.onAddApiKey }),
                        showTable ? (React.createElement(VerticalGroup, null,
                            React.createElement(InlineField, { label: "Show expired" },
                                React.createElement(InlineSwitch, { id: "showExpired", value: includeExpired, onChange: _this.onIncludeExpiredChange })),
                            React.createElement(ApiKeysTable, { apiKeys: apiKeys, timeZone: timeZone, onDelete: _this.onDeleteApiKey }))) : null));
                }))));
    };
    return ApiKeysPageUnconnected;
}(PureComponent));
export { ApiKeysPageUnconnected };
var ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
//# sourceMappingURL=ApiKeysPage.js.map