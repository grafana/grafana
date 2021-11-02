import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Button, useStyles2 } from '@grafana/ui';
import { emptyArrayFieldMatcher, emptyRoute } from '../../utils/amroutes';
import { EmptyArea } from '../EmptyArea';
import { AmRoutesTable } from './AmRoutesTable';
export var AmSpecificRouting = function (_a) {
    var onChange = _a.onChange, onRootRouteEdit = _a.onRootRouteEdit, receivers = _a.receivers, routes = _a.routes, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    var _c = __read(useState(routes.routes), 2), actualRoutes = _c[0], setActualRoutes = _c[1];
    var _d = __read(useState(false), 2), isAddMode = _d[0], setIsAddMode = _d[1];
    var styles = useStyles2(getStyles);
    var addNewRoute = function () {
        setIsAddMode(true);
        setActualRoutes(function (actualRoutes) { return __spreadArray(__spreadArray([], __read(actualRoutes), false), [
            __assign(__assign({}, emptyRoute), { matchers: [emptyArrayFieldMatcher] }),
        ], false); });
    };
    return (React.createElement("div", { className: styles.container },
        React.createElement("h5", null, "Specific routing"),
        React.createElement("p", null, "Send specific alerts to chosen contact points, based on matching criteria"),
        !routes.receiver ? (React.createElement(EmptyArea, { buttonIcon: "rocket", buttonLabel: "Set a default contact point", onButtonClick: onRootRouteEdit, text: "You haven't set a default contact point for the root route yet." })) : actualRoutes.length > 0 ? (React.createElement(React.Fragment, null,
            !isAddMode && !readOnly && (React.createElement(Button, { className: styles.addMatcherBtn, icon: "plus", onClick: addNewRoute, type: "button" }, "New policy")),
            React.createElement(AmRoutesTable, { isAddMode: isAddMode, readOnly: readOnly, onCancelAdd: function () {
                    setIsAddMode(false);
                    setActualRoutes(function (actualRoutes) {
                        var newRoutes = __spreadArray([], __read(actualRoutes), false);
                        newRoutes.pop();
                        return newRoutes;
                    });
                }, onChange: function (newRoutes) {
                    onChange(__assign(__assign({}, routes), { routes: newRoutes }));
                    if (isAddMode) {
                        setIsAddMode(false);
                    }
                }, receivers: receivers, routes: actualRoutes }))) : (React.createElement(EmptyArea, { buttonIcon: "plus", buttonLabel: "New specific policy", onButtonClick: addNewRoute, text: "You haven't created any specific policies yet." }))));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-flow: column nowrap;\n    "], ["\n      display: flex;\n      flex-flow: column nowrap;\n    "]))),
        addMatcherBtn: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      align-self: flex-end;\n      margin-bottom: ", ";\n    "], ["\n      align-self: flex-end;\n      margin-bottom: ", ";\n    "])), theme.spacing(3.5)),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=AmSpecificRouting.js.map