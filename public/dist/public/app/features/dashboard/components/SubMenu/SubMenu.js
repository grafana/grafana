import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getSubMenuVariables } from '../../../variables/state/selectors';
import { DashboardLinks } from './DashboardLinks';
import { Annotations } from './Annotations';
import { SubMenuItems } from './SubMenuItems';
import { css } from '@emotion/css';
var SubMenuUnConnected = /** @class */ (function (_super) {
    __extends(SubMenuUnConnected, _super);
    function SubMenuUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onAnnotationStateChanged = function (updatedAnnotation) {
            // we're mutating dashboard state directly here until annotations are in Redux.
            for (var index = 0; index < _this.props.dashboard.annotations.list.length; index++) {
                var annotation = _this.props.dashboard.annotations.list[index];
                if (annotation.name === updatedAnnotation.name) {
                    annotation.enable = !annotation.enable;
                    break;
                }
            }
            _this.props.dashboard.startRefresh();
            _this.forceUpdate();
        };
        return _this;
    }
    SubMenuUnConnected.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, variables = _a.variables, links = _a.links, annotations = _a.annotations;
        if (!dashboard.isSubMenuVisible()) {
            return null;
        }
        return (React.createElement("div", { className: "submenu-controls" },
            React.createElement("form", { "aria-label": "Template variables", className: styles },
                React.createElement(SubMenuItems, { variables: variables })),
            React.createElement(Annotations, { annotations: annotations, onAnnotationChanged: this.onAnnotationStateChanged, events: dashboard.events }),
            React.createElement("div", { className: "gf-form gf-form--grow" }),
            dashboard && React.createElement(DashboardLinks, { dashboard: dashboard, links: links }),
            React.createElement("div", { className: "clearfix" })));
    };
    return SubMenuUnConnected;
}(PureComponent));
var mapStateToProps = function (state) {
    return {
        variables: getSubMenuVariables(state.templating.variables),
    };
};
var styles = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  display: flex;\n  flex-wrap: wrap;\n  display: contents;\n"], ["\n  display: flex;\n  flex-wrap: wrap;\n  display: contents;\n"])));
export var SubMenu = connect(mapStateToProps)(SubMenuUnConnected);
SubMenu.displayName = 'SubMenu';
var templateObject_1;
//# sourceMappingURL=SubMenu.js.map