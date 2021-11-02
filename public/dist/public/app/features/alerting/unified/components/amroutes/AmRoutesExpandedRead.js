import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Button, useStyles2 } from '@grafana/ui';
import { emptyRoute } from '../../utils/amroutes';
import { AmRoutesTable } from './AmRoutesTable';
import { getGridStyles } from './gridStyles';
export var AmRoutesExpandedRead = function (_a) {
    var onChange = _a.onChange, receivers = _a.receivers, routes = _a.routes, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    var styles = useStyles2(getStyles);
    var gridStyles = useStyles2(getGridStyles);
    var groupWait = routes.groupWaitValue ? "" + routes.groupWaitValue + routes.groupWaitValueType : '-';
    var groupInterval = routes.groupIntervalValue
        ? "" + routes.groupIntervalValue + routes.groupIntervalValueType
        : '-';
    var repeatInterval = routes.repeatIntervalValue
        ? "" + routes.repeatIntervalValue + routes.repeatIntervalValueType
        : '-';
    var _c = __read(useState(routes.routes), 2), subroutes = _c[0], setSubroutes = _c[1];
    var _d = __read(useState(false), 2), isAddMode = _d[0], setIsAddMode = _d[1];
    return (React.createElement("div", { className: gridStyles.container },
        React.createElement("div", { className: gridStyles.titleCell }, "Group wait"),
        React.createElement("div", { className: gridStyles.valueCell }, groupWait),
        React.createElement("div", { className: gridStyles.titleCell }, "Group interval"),
        React.createElement("div", { className: gridStyles.valueCell }, groupInterval),
        React.createElement("div", { className: gridStyles.titleCell }, "Repeat interval"),
        React.createElement("div", { className: gridStyles.valueCell }, repeatInterval),
        React.createElement("div", { className: gridStyles.titleCell }, "Nested policies"),
        React.createElement("div", { className: gridStyles.valueCell },
            !!subroutes.length ? (React.createElement(AmRoutesTable, { isAddMode: isAddMode, onCancelAdd: function () {
                    setIsAddMode(false);
                    setSubroutes(function (subroutes) {
                        var newSubroutes = __spreadArray([], __read(subroutes), false);
                        newSubroutes.pop();
                        return newSubroutes;
                    });
                }, onChange: function (newRoutes) {
                    onChange(__assign(__assign({}, routes), { routes: newRoutes }));
                    if (isAddMode) {
                        setIsAddMode(false);
                    }
                }, receivers: receivers, routes: subroutes })) : (React.createElement("p", null, "No nested policies configured.")),
            !isAddMode && !readOnly && (React.createElement(Button, { className: styles.addNestedRoutingBtn, icon: "plus", onClick: function () {
                    setSubroutes(function (subroutes) { return __spreadArray(__spreadArray([], __read(subroutes), false), [emptyRoute], false); });
                    setIsAddMode(true);
                }, variant: "secondary", type: "button" }, "Add nested policy")))));
};
var getStyles = function (theme) {
    return {
        addNestedRoutingBtn: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(2)),
    };
};
var templateObject_1;
//# sourceMappingURL=AmRoutesExpandedRead.js.map