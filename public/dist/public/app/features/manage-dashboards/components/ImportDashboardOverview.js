import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Form, Legend } from '@grafana/ui';
import { connect } from 'react-redux';
import { ImportDashboardForm } from './ImportDashboardForm';
import { clearLoadedDashboard, importDashboard } from '../state/actions';
import { DashboardSource } from '../state/reducers';
import { locationService } from '@grafana/runtime';
var mapStateToProps = function (state) {
    var searchObj = locationService.getSearchObject();
    return {
        dashboard: state.importDashboard.dashboard,
        meta: state.importDashboard.meta,
        source: state.importDashboard.source,
        inputs: state.importDashboard.inputs,
        folder: searchObj.folderId ? { id: Number(searchObj.folderId) } : { id: 0 },
    };
};
var mapDispatchToProps = {
    clearLoadedDashboard: clearLoadedDashboard,
    importDashboard: importDashboard,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var ImportDashboardOverviewUnConnected = /** @class */ (function (_super) {
    __extends(ImportDashboardOverviewUnConnected, _super);
    function ImportDashboardOverviewUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            uidReset: false,
        };
        _this.onSubmit = function (form) {
            _this.props.importDashboard(form);
        };
        _this.onCancel = function () {
            _this.props.clearLoadedDashboard();
        };
        _this.onUidReset = function () {
            _this.setState({ uidReset: true });
        };
        return _this;
    }
    ImportDashboardOverviewUnConnected.prototype.render = function () {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, inputs = _a.inputs, meta = _a.meta, source = _a.source, folder = _a.folder;
        var uidReset = this.state.uidReset;
        return (React.createElement(React.Fragment, null,
            source === DashboardSource.Gcom && (React.createElement("div", { style: { marginBottom: '24px' } },
                React.createElement("div", null,
                    React.createElement(Legend, null,
                        "Importing dashboard from",
                        ' ',
                        React.createElement("a", { href: "https://grafana.com/dashboards/" + dashboard.gnetId, className: "external-link", target: "_blank", rel: "noreferrer" }, "Grafana.com"))),
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", null, "Published by"),
                            React.createElement("td", null, meta.orgName)),
                        React.createElement("tr", null,
                            React.createElement("td", null, "Updated on"),
                            React.createElement("td", null, dateTimeFormat(meta.updatedAt))))))),
            React.createElement(Form, { onSubmit: this.onSubmit, defaultValues: __assign(__assign({}, dashboard), { constants: [], dataSources: [], elements: [], folder: folder }), validateOnMount: true, validateFieldsOnMount: ['title', 'uid'], validateOn: "onChange" }, function (_a) {
                var register = _a.register, errors = _a.errors, control = _a.control, watch = _a.watch, getValues = _a.getValues;
                return (React.createElement(ImportDashboardForm, { register: register, errors: errors, control: control, getValues: getValues, uidReset: uidReset, inputs: inputs, onCancel: _this.onCancel, onUidReset: _this.onUidReset, onSubmit: _this.onSubmit, watch: watch, initialFolderId: folder.id }));
            })));
    };
    return ImportDashboardOverviewUnConnected;
}(PureComponent));
export var ImportDashboardOverview = connector(ImportDashboardOverviewUnConnected);
ImportDashboardOverview.displayName = 'ImportDashboardOverview';
//# sourceMappingURL=ImportDashboardOverview.js.map