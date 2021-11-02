import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { Button, CustomScrollbar, Icon, PageToolbar, stylesFactory } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { SaveDashboardButton, SaveDashboardAsButton } from '../SaveDashboard/SaveDashboardButton';
import { VariableEditorContainer } from '../../../variables/editor/VariableEditorContainer';
import { DashboardPermissions } from '../DashboardPermissions/DashboardPermissions';
import { GeneralSettings } from './GeneralSettings';
import { AnnotationsSettings } from './AnnotationsSettings';
import { LinksSettings } from './LinksSettings';
import { VersionsSettings } from './VersionsSettings';
import { JsonEditorSettings } from './JsonEditorSettings';
import { locationService } from '@grafana/runtime';
var DashboardSettings = /** @class */ (function (_super) {
    __extends(DashboardSettings, _super);
    function DashboardSettings() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClose = function () {
            locationService.partial({ editview: null });
        };
        _this.onChangePage = function (editview) {
            locationService.partial({ editview: editview });
        };
        _this.onMakeEditable = function () {
            var dashboard = _this.props.dashboard;
            dashboard.editable = true;
            dashboard.meta.canMakeEditable = false;
            dashboard.meta.canEdit = true;
            dashboard.meta.canSave = true;
            _this.forceUpdate();
        };
        _this.onPostSave = function () {
            _this.props.dashboard.meta.hasUnsavedFolderChange = false;
            dashboardWatcher.reloadPage();
        };
        return _this;
    }
    DashboardSettings.prototype.getPages = function () {
        var _this = this;
        var dashboard = this.props.dashboard;
        var pages = [];
        if (dashboard.meta.canEdit) {
            pages.push(this.getGeneralPage());
            pages.push({
                title: 'Annotations',
                id: 'annotations',
                icon: 'comment-alt',
                render: function () { return React.createElement(AnnotationsSettings, { dashboard: dashboard }); },
            });
            pages.push({
                title: 'Variables',
                id: 'templating',
                icon: 'calculator-alt',
                render: function () { return React.createElement(VariableEditorContainer, null); },
            });
            pages.push({
                title: 'Links',
                id: 'links',
                icon: 'link',
                render: function () { return React.createElement(LinksSettings, { dashboard: dashboard }); },
            });
        }
        if (dashboard.meta.canMakeEditable) {
            pages.push({
                title: 'General',
                icon: 'sliders-v-alt',
                id: 'settings',
                render: function () { return _this.renderMakeEditable(); },
            });
        }
        if (dashboard.id && dashboard.meta.canSave) {
            pages.push({
                title: 'Versions',
                id: 'versions',
                icon: 'history',
                render: function () { return React.createElement(VersionsSettings, { dashboard: dashboard }); },
            });
        }
        if (dashboard.id && dashboard.meta.canAdmin) {
            pages.push({
                title: 'Permissions',
                id: 'permissions',
                icon: 'lock',
                render: function () { return React.createElement(DashboardPermissions, { dashboard: dashboard }); },
            });
        }
        pages.push({
            title: 'JSON Model',
            id: 'dashboard_json',
            icon: 'arrow',
            render: function () { return React.createElement(JsonEditorSettings, { dashboard: dashboard }); },
        });
        return pages;
    };
    DashboardSettings.prototype.renderMakeEditable = function () {
        return (React.createElement("div", null,
            React.createElement("div", { className: "dashboard-settings__header" }, "Dashboard not editable"),
            React.createElement(Button, { onClick: this.onMakeEditable }, "Make editable")));
    };
    DashboardSettings.prototype.getGeneralPage = function () {
        var _this = this;
        return {
            title: 'General',
            id: 'settings',
            icon: 'sliders-v-alt',
            render: function () { return React.createElement(GeneralSettings, { dashboard: _this.props.dashboard }); },
        };
    };
    DashboardSettings.prototype.render = function () {
        var _this = this;
        var _a;
        var _b = this.props, dashboard = _b.dashboard, editview = _b.editview;
        var folderTitle = dashboard.meta.folderTitle;
        var pages = this.getPages();
        var currentPage = (_a = pages.find(function (page) { return page.id === editview; })) !== null && _a !== void 0 ? _a : pages[0];
        var canSaveAs = contextSrv.hasEditPermissionInFolders;
        var canSave = dashboard.meta.canSave;
        var styles = getStyles(config.theme2);
        return (React.createElement("div", { className: "dashboard-settings" },
            React.createElement(PageToolbar, { title: dashboard.title + " / Settings", parent: folderTitle, onGoBack: this.onClose }),
            React.createElement(CustomScrollbar, null,
                React.createElement("div", { className: styles.scrollInner },
                    React.createElement("div", { className: styles.settingsWrapper },
                        React.createElement("aside", { className: "dashboard-settings__aside" },
                            pages.map(function (page) { return (React.createElement("a", { className: cx('dashboard-settings__nav-item', { active: page.id === editview }), "aria-label": selectors.pages.Dashboard.Settings.General.sectionItems(page.title), onClick: function () { return _this.onChangePage(page.id); }, key: page.id },
                                React.createElement(Icon, { name: page.icon, style: { marginRight: '4px' } }),
                                page.title)); }),
                            React.createElement("div", { className: "dashboard-settings__aside-actions" },
                                canSave && React.createElement(SaveDashboardButton, { dashboard: dashboard, onSaveSuccess: this.onPostSave }),
                                canSaveAs && (React.createElement(SaveDashboardAsButton, { dashboard: dashboard, onSaveSuccess: this.onPostSave, variant: "secondary" })))),
                        React.createElement("div", { className: styles.settingsContent }, currentPage.render()))))));
    };
    return DashboardSettings;
}(PureComponent));
export { DashboardSettings };
var getStyles = stylesFactory(function (theme) { return ({
    scrollInner: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    min-width: 100%;\n    display: flex;\n  "], ["\n    min-width: 100%;\n    display: flex;\n  "]))),
    settingsWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin: ", ";\n    display: flex;\n    flex-grow: 1;\n  "], ["\n    margin: ", ";\n    display: flex;\n    flex-grow: 1;\n  "])), theme.spacing(0, 2, 2)),
    settingsContent: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    flex-grow: 1;\n    height: 100%;\n    padding: 32px;\n    border: 1px solid ", ";\n    background: ", ";\n    border-radius: ", ";\n  "], ["\n    flex-grow: 1;\n    height: 100%;\n    padding: 32px;\n    border: 1px solid ", ";\n    background: ", ";\n    border-radius: ", ";\n  "])), theme.colors.border.weak, theme.colors.background.primary, theme.shape.borderRadius()),
}); });
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=DashboardSettings.js.map