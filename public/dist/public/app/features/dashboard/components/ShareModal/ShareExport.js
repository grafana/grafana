import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { saveAs } from 'file-saver';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Button, Field, Modal, Switch } from '@grafana/ui';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { appEvents } from 'app/core/core';
import { ShowModalReactEvent } from 'app/types/events';
import { ViewJsonModal } from './ViewJsonModal';
import { config } from '@grafana/runtime';
var ShareExport = /** @class */ (function (_super) {
    __extends(ShareExport, _super);
    function ShareExport(props) {
        var _this = _super.call(this, props) || this;
        _this.onShareExternallyChange = function () {
            _this.setState({
                shareExternally: !_this.state.shareExternally,
            });
        };
        _this.onTrimDefaultsChange = function () {
            _this.setState({
                trimDefaults: !_this.state.trimDefaults,
            });
        };
        _this.onSaveAsFile = function () {
            var dashboard = _this.props.dashboard;
            var shareExternally = _this.state.shareExternally;
            var trimDefaults = _this.state.trimDefaults;
            if (shareExternally) {
                _this.exporter.makeExportable(dashboard).then(function (dashboardJson) {
                    if (trimDefaults) {
                        getBackendSrv()
                            .post('/api/dashboards/trim', { dashboard: dashboardJson })
                            .then(function (resp) {
                            _this.openSaveAsDialog(resp.dashboard);
                        });
                    }
                    else {
                        _this.openSaveAsDialog(dashboardJson);
                    }
                });
            }
            else {
                if (trimDefaults) {
                    getBackendSrv()
                        .post('/api/dashboards/trim', { dashboard: dashboard.getSaveModelClone() })
                        .then(function (resp) {
                        _this.openSaveAsDialog(resp.dashboard);
                    });
                }
                else {
                    _this.openSaveAsDialog(dashboard.getSaveModelClone());
                }
            }
        };
        _this.onViewJson = function () {
            var dashboard = _this.props.dashboard;
            var shareExternally = _this.state.shareExternally;
            var trimDefaults = _this.state.trimDefaults;
            if (shareExternally) {
                _this.exporter.makeExportable(dashboard).then(function (dashboardJson) {
                    if (trimDefaults) {
                        getBackendSrv()
                            .post('/api/dashboards/trim', { dashboard: dashboardJson })
                            .then(function (resp) {
                            _this.openJsonModal(resp.dashboard);
                        });
                    }
                    else {
                        _this.openJsonModal(dashboardJson);
                    }
                });
            }
            else {
                if (trimDefaults) {
                    getBackendSrv()
                        .post('/api/dashboards/trim', { dashboard: dashboard.getSaveModelClone() })
                        .then(function (resp) {
                        _this.openJsonModal(resp.dashboard);
                    });
                }
                else {
                    _this.openJsonModal(dashboard.getSaveModelClone());
                }
            }
        };
        _this.openSaveAsDialog = function (dash) {
            var dashboardJsonPretty = JSON.stringify(dash, null, 2);
            var blob = new Blob([dashboardJsonPretty], {
                type: 'application/json;charset=utf-8',
            });
            var time = new Date().getTime();
            saveAs(blob, dash.title + "-" + time + ".json");
        };
        _this.openJsonModal = function (clone) {
            var _a, _b;
            appEvents.publish(new ShowModalReactEvent({
                props: {
                    json: JSON.stringify(clone, null, 2),
                },
                component: ViewJsonModal,
            }));
            (_b = (_a = _this.props).onDismiss) === null || _b === void 0 ? void 0 : _b.call(_a);
        };
        _this.state = {
            shareExternally: false,
            trimDefaults: false,
        };
        _this.exporter = new DashboardExporter();
        return _this;
    }
    ShareExport.prototype.render = function () {
        var onDismiss = this.props.onDismiss;
        var shareExternally = this.state.shareExternally;
        var trimDefaults = this.state.trimDefaults;
        return (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "share-modal-info-text" }, "Export this dashboard."),
            React.createElement(Field, { label: "Export for sharing externally" },
                React.createElement(Switch, { id: "share-externally-toggle", value: shareExternally, onChange: this.onShareExternallyChange })),
            config.featureToggles.trimDefaults && (React.createElement(Field, { label: "Export with default values removed" },
                React.createElement(Switch, { id: "trim-defaults-toggle", value: trimDefaults, onChange: this.onTrimDefaultsChange }))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { variant: "secondary", onClick: this.onViewJson }, "View JSON"),
                React.createElement(Button, { variant: "primary", onClick: this.onSaveAsFile }, "Save to file"))));
    };
    return ShareExport;
}(PureComponent));
export { ShareExport };
//# sourceMappingURL=ShareExport.js.map