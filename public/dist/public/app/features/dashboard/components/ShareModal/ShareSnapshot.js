import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { Button, ClipboardButton, Field, Icon, Input, LinkButton, Modal, Select, Spinner } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { appEvents } from 'app/core/core';
import { VariableRefresh } from '../../../variables/types';
var snapshotApiUrl = '/api/snapshots';
var expireOptions = [
    { label: 'Never', value: 0 },
    { label: '1 Hour', value: 60 * 60 },
    { label: '1 Day', value: 60 * 60 * 24 },
    { label: '7 Days', value: 60 * 60 * 24 * 7 },
];
var ShareSnapshot = /** @class */ (function (_super) {
    __extends(ShareSnapshot, _super);
    function ShareSnapshot(props) {
        var _this = _super.call(this, props) || this;
        _this.createSnapshot = function (external) { return function () {
            var timeoutSeconds = _this.state.timeoutSeconds;
            _this.dashboard.snapshot = {
                timestamp: new Date(),
            };
            if (!external) {
                _this.dashboard.snapshot.originalUrl = window.location.href;
            }
            _this.setState({ isLoading: true });
            _this.dashboard.startRefresh();
            setTimeout(function () {
                _this.saveSnapshot(_this.dashboard, external);
            }, timeoutSeconds * 1000);
        }; };
        _this.saveSnapshot = function (dashboard, external) { return __awaiter(_this, void 0, void 0, function () {
            var snapshotExpires, dash, cmdData, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        snapshotExpires = this.state.snapshotExpires;
                        dash = this.dashboard.getSaveModelClone();
                        this.scrubDashboard(dash);
                        cmdData = {
                            dashboard: dash,
                            name: dash.title,
                            expires: snapshotExpires,
                            external: external,
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, getBackendSrv().post(snapshotApiUrl, cmdData)];
                    case 2:
                        results = _a.sent();
                        this.setState({
                            deleteUrl: results.deleteUrl,
                            snapshotUrl: results.url,
                            step: 2,
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        this.setState({ isLoading: false });
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        _this.scrubDashboard = function (dash) {
            var panel = _this.props.panel;
            var snapshotName = _this.state.snapshotName;
            // change title
            dash.title = snapshotName;
            // make relative times absolute
            dash.time = getTimeSrv().timeRange();
            // Remove links
            dash.links = [];
            // remove panel queries & links
            dash.panels.forEach(function (panel) {
                panel.targets = [];
                panel.links = [];
                panel.datasource = null;
            });
            // remove annotation queries
            var annotations = dash.annotations.list.filter(function (annotation) { return annotation.enable; });
            dash.annotations.list = annotations.map(function (annotation) {
                return {
                    name: annotation.name,
                    enable: annotation.enable,
                    iconColor: annotation.iconColor,
                    snapshotData: annotation.snapshotData,
                    type: annotation.type,
                    builtIn: annotation.builtIn,
                    hide: annotation.hide,
                };
            });
            // remove template queries
            dash.getVariables().forEach(function (variable) {
                variable.query = '';
                variable.options = variable.current ? [variable.current] : [];
                variable.refresh = VariableRefresh.never;
            });
            // snapshot single panel
            if (panel) {
                var singlePanel = panel.getSaveModel();
                singlePanel.gridPos.w = 24;
                singlePanel.gridPos.x = 0;
                singlePanel.gridPos.y = 0;
                singlePanel.gridPos.h = 20;
                dash.panels = [singlePanel];
            }
            // cleanup snapshotData
            delete _this.dashboard.snapshot;
            _this.dashboard.forEachPanel(function (panel) {
                delete panel.snapshotData;
            });
            _this.dashboard.annotations.list.forEach(function (annotation) {
                delete annotation.snapshotData;
            });
        };
        _this.deleteSnapshot = function () { return __awaiter(_this, void 0, void 0, function () {
            var deleteUrl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        deleteUrl = this.state.deleteUrl;
                        return [4 /*yield*/, getBackendSrv().get(deleteUrl)];
                    case 1:
                        _a.sent();
                        this.setState({ step: 3 });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.getSnapshotUrl = function () {
            return _this.state.snapshotUrl;
        };
        _this.onSnapshotNameChange = function (event) {
            _this.setState({ snapshotName: event.target.value });
        };
        _this.onTimeoutChange = function (event) {
            _this.setState({ timeoutSeconds: Number(event.target.value) });
        };
        _this.onExpireChange = function (option) {
            _this.setState({
                selectedExpireOption: option,
                snapshotExpires: option.value,
            });
        };
        _this.onSnapshotUrlCopy = function () {
            appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
        };
        _this.dashboard = props.dashboard;
        _this.state = {
            isLoading: false,
            step: 1,
            selectedExpireOption: expireOptions[0],
            snapshotExpires: expireOptions[0].value,
            snapshotName: props.dashboard.title,
            timeoutSeconds: 4,
            snapshotUrl: '',
            deleteUrl: '',
            externalEnabled: false,
            sharingButtonText: '',
        };
        return _this;
    }
    ShareSnapshot.prototype.componentDidMount = function () {
        this.getSnaphotShareOptions();
    };
    ShareSnapshot.prototype.getSnaphotShareOptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var shareOptions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBackendSrv().get('/api/snapshot/shared-options')];
                    case 1:
                        shareOptions = _a.sent();
                        this.setState({
                            sharingButtonText: shareOptions['externalSnapshotName'],
                            externalEnabled: shareOptions['externalEnabled'],
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    ShareSnapshot.prototype.renderStep1 = function () {
        var onDismiss = this.props.onDismiss;
        var _a = this.state, snapshotName = _a.snapshotName, selectedExpireOption = _a.selectedExpireOption, timeoutSeconds = _a.timeoutSeconds, isLoading = _a.isLoading, sharingButtonText = _a.sharingButtonText, externalEnabled = _a.externalEnabled;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", null,
                React.createElement("p", { className: "share-modal-info-text" }, "A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip sensitive data like queries (metric, template, and annotation) and panel links, leaving only the visible metric data and series names embedded in your dashboard."),
                React.createElement("p", { className: "share-modal-info-text" },
                    "Keep in mind, your snapshot ",
                    React.createElement("em", null, "can be viewed by anyone"),
                    " that has the link and can access the URL. Share wisely.")),
            React.createElement(Field, { label: "Snapshot name" },
                React.createElement(Input, { id: "snapshot-name-input", width: 30, value: snapshotName, onChange: this.onSnapshotNameChange })),
            React.createElement(Field, { label: "Expire" },
                React.createElement(Select, { inputId: "expire-select-input", menuShouldPortal: true, width: 30, options: expireOptions, value: selectedExpireOption, onChange: this.onExpireChange })),
            React.createElement(Field, { label: "Timeout (seconds)", description: "You might need to configure the timeout value if it takes a long time to collect your dashboard\n            metrics." },
                React.createElement(Input, { id: "timeout-input", type: "number", width: 21, value: timeoutSeconds, onChange: this.onTimeoutChange })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                externalEnabled && (React.createElement(Button, { variant: "secondary", disabled: isLoading, onClick: this.createSnapshot(true) }, sharingButtonText)),
                React.createElement(Button, { variant: "primary", disabled: isLoading, onClick: this.createSnapshot() }, "Local Snapshot"))));
    };
    ShareSnapshot.prototype.renderStep2 = function () {
        var snapshotUrl = this.state.snapshotUrl;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form", style: { marginTop: '40px' } },
                React.createElement("div", { className: "gf-form-row" },
                    React.createElement("a", { href: snapshotUrl, className: "large share-modal-link", target: "_blank", rel: "noreferrer" },
                        React.createElement(Icon, { name: "external-link-alt" }),
                        " ",
                        snapshotUrl),
                    React.createElement("br", null),
                    React.createElement(ClipboardButton, { variant: "secondary", getText: this.getSnapshotUrl, onClipboardCopy: this.onSnapshotUrlCopy }, "Copy Link"))),
            React.createElement("div", { className: "pull-right", style: { padding: '5px' } },
                "Did you make a mistake?",
                ' ',
                React.createElement(LinkButton, { fill: "text", target: "_blank", onClick: this.deleteSnapshot }, "Delete snapshot."))));
    };
    ShareSnapshot.prototype.renderStep3 = function () {
        return (React.createElement("div", { className: "share-modal-header" },
            React.createElement("p", { className: "share-modal-info-text" }, "The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before before it is removed from browser caches or CDN caches.")));
    };
    ShareSnapshot.prototype.render = function () {
        var _a = this.state, isLoading = _a.isLoading, step = _a.step;
        return (React.createElement(React.Fragment, null,
            step === 1 && this.renderStep1(),
            step === 2 && this.renderStep2(),
            step === 3 && this.renderStep3(),
            isLoading && React.createElement(Spinner, { inline: true })));
    };
    return ShareSnapshot;
}(PureComponent));
export { ShareSnapshot };
//# sourceMappingURL=ShareSnapshot.js.map