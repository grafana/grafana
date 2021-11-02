import { __assign, __awaiter, __extends, __generator, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { Spinner, HorizontalGroup } from '@grafana/ui';
import { historySrv, VersionHistoryTable, VersionHistoryHeader, VersionsHistoryButtons, VersionHistoryComparison, } from '../VersionHistory';
export var VERSIONS_FETCH_LIMIT = 10;
var VersionsSettings = /** @class */ (function (_super) {
    __extends(VersionsSettings, _super);
    function VersionsSettings(props) {
        var _this = _super.call(this, props) || this;
        _this.getVersions = function (append) {
            if (append === void 0) { append = false; }
            _this.setState({ isAppending: append });
            historySrv
                .getHistoryList(_this.props.dashboard, { limit: _this.limit, start: _this.start })
                .then(function (res) {
                _this.setState({
                    isLoading: false,
                    versions: __spreadArray(__spreadArray([], __read(_this.state.versions), false), __read(_this.decorateVersions(res)), false),
                });
                _this.start += _this.limit;
            })
                .catch(function (err) { return console.log(err); })
                .finally(function () { return _this.setState({ isAppending: false }); });
        };
        _this.getDiff = function () { return __awaiter(_this, void 0, void 0, function () {
            var selectedVersions, _a, newInfo, baseInfo, isNewLatest, lhs, rhs;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        selectedVersions = this.state.versions.filter(function (version) { return version.checked; });
                        _a = __read(selectedVersions, 2), newInfo = _a[0], baseInfo = _a[1];
                        isNewLatest = newInfo.version === this.props.dashboard.version;
                        this.setState({
                            isLoading: true,
                        });
                        return [4 /*yield*/, historySrv.getDashboardVersion(this.props.dashboard.id, baseInfo.version)];
                    case 1:
                        lhs = _b.sent();
                        return [4 /*yield*/, historySrv.getDashboardVersion(this.props.dashboard.id, newInfo.version)];
                    case 2:
                        rhs = _b.sent();
                        this.setState({
                            baseInfo: baseInfo,
                            isLoading: false,
                            isNewLatest: isNewLatest,
                            newInfo: newInfo,
                            viewMode: 'compare',
                            diffData: {
                                lhs: lhs.data,
                                rhs: rhs.data,
                            },
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.decorateVersions = function (versions) {
            return versions.map(function (version) { return (__assign(__assign({}, version), { createdDateString: _this.props.dashboard.formatDate(version.created), ageString: _this.props.dashboard.getRelativeTime(version.created), checked: false })); });
        };
        _this.onCheck = function (ev, versionId) {
            _this.setState({
                versions: _this.state.versions.map(function (version) {
                    return version.id === versionId ? __assign(__assign({}, version), { checked: ev.currentTarget.checked }) : version;
                }),
            });
        };
        _this.reset = function () {
            _this.setState({
                baseInfo: undefined,
                diffData: {
                    lhs: {},
                    rhs: {},
                },
                isNewLatest: false,
                newInfo: undefined,
                versions: _this.state.versions.map(function (version) { return (__assign(__assign({}, version), { checked: false })); }),
                viewMode: 'list',
            });
        };
        _this.limit = VERSIONS_FETCH_LIMIT;
        _this.start = 0;
        _this.state = {
            isAppending: true,
            isLoading: true,
            versions: [],
            viewMode: 'list',
            isNewLatest: false,
            diffData: {
                lhs: {},
                rhs: {},
            },
        };
        return _this;
    }
    VersionsSettings.prototype.componentDidMount = function () {
        this.getVersions();
    };
    VersionsSettings.prototype.isLastPage = function () {
        return this.state.versions.find(function (rev) { return rev.version === 1; });
    };
    VersionsSettings.prototype.render = function () {
        var _a = this.state, versions = _a.versions, viewMode = _a.viewMode, baseInfo = _a.baseInfo, newInfo = _a.newInfo, isNewLatest = _a.isNewLatest, isLoading = _a.isLoading, diffData = _a.diffData;
        var canCompare = versions.filter(function (version) { return version.checked; }).length !== 2;
        var showButtons = versions.length > 1;
        var hasMore = versions.length >= this.limit;
        if (viewMode === 'compare') {
            return (React.createElement("div", null,
                React.createElement(VersionHistoryHeader, { isComparing: true, onClick: this.reset, baseVersion: baseInfo === null || baseInfo === void 0 ? void 0 : baseInfo.version, newVersion: newInfo === null || newInfo === void 0 ? void 0 : newInfo.version, isNewLatest: isNewLatest }),
                isLoading ? (React.createElement(VersionsHistorySpinner, { msg: "Fetching changes\u2026" })) : (React.createElement(VersionHistoryComparison, { newInfo: newInfo, baseInfo: baseInfo, isNewLatest: isNewLatest, diffData: diffData }))));
        }
        return (React.createElement("div", null,
            React.createElement(VersionHistoryHeader, null),
            isLoading ? (React.createElement(VersionsHistorySpinner, { msg: "Fetching history list\u2026" })) : (React.createElement(VersionHistoryTable, { versions: versions, onCheck: this.onCheck })),
            this.state.isAppending && React.createElement(VersionsHistorySpinner, { msg: "Fetching more entries\u2026" }),
            showButtons && (React.createElement(VersionsHistoryButtons, { hasMore: hasMore, canCompare: canCompare, getVersions: this.getVersions, getDiff: this.getDiff, isLastPage: !!this.isLastPage() }))));
    };
    return VersionsSettings;
}(PureComponent));
export { VersionsSettings };
var VersionsHistorySpinner = function (_a) {
    var msg = _a.msg;
    return (React.createElement(HorizontalGroup, null,
        React.createElement(Spinner, null),
        React.createElement("em", null, msg)));
};
//# sourceMappingURL=VersionsSettings.js.map