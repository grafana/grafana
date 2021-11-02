import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { Modal, stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { dashboardWatcher } from './dashboardWatcher';
import { config } from '@grafana/runtime';
import { DashboardEventAction } from './types';
var DashboardChangedModal = /** @class */ (function (_super) {
    __extends(DashboardChangedModal, _super);
    function DashboardChangedModal() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {};
        _this.discardAndReload = {
            label: 'Discard local changes',
            description: 'Load the latest saved version for this dashboard',
            action: function () {
                dashboardWatcher.reloadPage();
                _this.onDismiss();
            },
        };
        _this.continueEditing = {
            label: 'Continue editing',
            description: 'Keep your local changes and continue editing.  Note: when you save, this will overwrite the most recent chages',
            action: function () {
                _this.onDismiss();
            },
        };
        _this.acceptDelete = {
            label: 'Discard Local changes',
            description: 'view grafana homepage',
            action: function () {
                // Navigate to the root URL
                document.location.href = config.appUrl;
            },
        };
        _this.onDismiss = function () {
            _this.setState({ dismiss: true });
        };
        return _this;
    }
    DashboardChangedModal.prototype.render = function () {
        var event = this.props.event;
        var dismiss = this.state.dismiss;
        var styles = getStyles(config.theme);
        var isDelete = (event === null || event === void 0 ? void 0 : event.action) === DashboardEventAction.Deleted;
        var options = isDelete
            ? [this.continueEditing, this.acceptDelete]
            : [this.continueEditing, this.discardAndReload];
        return (React.createElement(Modal, { isOpen: !dismiss, title: "Dashboard Changed", icon: "copy", onDismiss: this.onDismiss, onClickBackdrop: function () { }, className: styles.modal },
            React.createElement("div", null,
                isDelete ? (React.createElement("div", null, "This dashboard has been deleted by another session")) : (React.createElement("div", null, "This dashboard has been modifed by another session")),
                React.createElement("br", null),
                options.map(function (opt) {
                    return (React.createElement("div", { key: opt.label, onClick: opt.action, className: styles.radioItem },
                        React.createElement("h3", null, opt.label),
                        opt.description));
                }),
                React.createElement("br", null))));
    };
    return DashboardChangedModal;
}(PureComponent));
export { DashboardChangedModal };
var getStyles = stylesFactory(function (theme) {
    return {
        modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 500px;\n    "], ["\n      width: 500px;\n    "]))),
        radioItem: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin: 0;\n      font-size: ", ";\n      color: ", ";\n      padding: 10px;\n      cursor: pointer;\n      width: 100%;\n\n      &:hover {\n        background: ", ";\n        color: ", ";\n      }\n    "], ["\n      margin: 0;\n      font-size: ", ";\n      color: ", ";\n      padding: 10px;\n      cursor: pointer;\n      width: 100%;\n\n      &:hover {\n        background: ", ";\n        color: ", ";\n      }\n    "])), theme.typography.size.sm, theme.colors.textWeak, theme.colors.bgBlue1, theme.colors.text),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=DashboardChangedModal.js.map