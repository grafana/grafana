import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { AppEvents } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, stylesFactory, withTheme2, Input, TextArea, Field, Form, FileUpload } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';
import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import { validateDashboardJson, validateGcomDashboard } from './utils/validation';
import { fetchGcomDashboard, importDashboardJson } from './state/actions';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
var UnthemedDashboardImport = /** @class */ (function (_super) {
    __extends(UnthemedDashboardImport, _super);
    function UnthemedDashboardImport() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onFileUpload = function (event) {
            var importDashboardJson = _this.props.importDashboardJson;
            var file = event.currentTarget.files && event.currentTarget.files.length > 0 && event.currentTarget.files[0];
            if (file) {
                var reader = new FileReader();
                var readerOnLoad = function () {
                    return function (e) {
                        var dashboard;
                        try {
                            dashboard = JSON.parse(e.target.result);
                        }
                        catch (error) {
                            appEvents.emit(AppEvents.alertError, [
                                'Import failed',
                                'JSON -> JS Serialization failed: ' + error.message,
                            ]);
                            return;
                        }
                        importDashboardJson(dashboard);
                    };
                };
                reader.onload = readerOnLoad();
                reader.readAsText(file);
            }
        };
        _this.getDashboardFromJson = function (formData) {
            _this.props.importDashboardJson(JSON.parse(formData.dashboardJson));
        };
        _this.getGcomDashboard = function (formData) {
            var dashboardId;
            var match = /(^\d+$)|dashboards\/(\d+)/.exec(formData.gcomDashboard);
            if (match && match[1]) {
                dashboardId = match[1];
            }
            else if (match && match[2]) {
                dashboardId = match[2];
            }
            if (dashboardId) {
                _this.props.fetchGcomDashboard(dashboardId);
            }
        };
        return _this;
    }
    UnthemedDashboardImport.prototype.renderImportForm = function () {
        var styles = importStyles(this.props.theme);
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.option },
                React.createElement(FileUpload, { accept: "application/json", onFileUpload: this.onFileUpload }, "Upload JSON file")),
            React.createElement("div", { className: styles.option },
                React.createElement(Form, { onSubmit: this.getGcomDashboard, defaultValues: { gcomDashboard: '' } }, function (_a) {
                    var register = _a.register, errors = _a.errors;
                    return (React.createElement(Field, { label: "Import via grafana.com", invalid: !!errors.gcomDashboard, error: errors.gcomDashboard && errors.gcomDashboard.message },
                        React.createElement(Input, __assign({ id: "url-input", placeholder: "Grafana.com dashboard URL or ID", type: "text" }, register('gcomDashboard', {
                            required: 'A Grafana dashboard URL or ID is required',
                            validate: validateGcomDashboard,
                        }), { addonAfter: React.createElement(Button, { type: "submit" }, "Load") }))));
                })),
            React.createElement("div", { className: styles.option },
                React.createElement(Form, { onSubmit: this.getDashboardFromJson, defaultValues: { dashboardJson: '' } }, function (_a) {
                    var register = _a.register, errors = _a.errors;
                    return (React.createElement(React.Fragment, null,
                        React.createElement(Field, { label: "Import via panel json", invalid: !!errors.dashboardJson, error: errors.dashboardJson && errors.dashboardJson.message },
                            React.createElement(TextArea, __assign({}, register('dashboardJson', {
                                required: 'Need a dashboard JSON model',
                                validate: validateDashboardJson,
                            }), { "data-testid": selectors.components.DashboardImportPage.textarea, id: "dashboard-json-textarea", rows: 10 }))),
                        React.createElement(Button, { type: "submit", "data-testid": selectors.components.DashboardImportPage.submit }, "Load")));
                }))));
    };
    UnthemedDashboardImport.prototype.render = function () {
        var _a = this.props, isLoaded = _a.isLoaded, navModel = _a.navModel;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, null, isLoaded ? React.createElement(ImportDashboardOverview, null) : this.renderImportForm())));
    };
    return UnthemedDashboardImport;
}(PureComponent));
var DashboardImportUnConnected = withTheme2(UnthemedDashboardImport);
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'import', undefined, true),
    isLoaded: state.importDashboard.isLoaded,
}); };
var mapDispatchToProps = {
    fetchGcomDashboard: fetchGcomDashboard,
    importDashboardJson: importDashboardJson,
};
export var DashboardImportPage = connectWithCleanUp(mapStateToProps, mapDispatchToProps, function (state) { return state.importDashboard; })(DashboardImportUnConnected);
export default DashboardImportPage;
DashboardImportPage.displayName = 'DashboardImport';
var importStyles = stylesFactory(function (theme) {
    return {
        option: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(4)),
    };
});
var templateObject_1;
//# sourceMappingURL=DashboardImportPage.js.map