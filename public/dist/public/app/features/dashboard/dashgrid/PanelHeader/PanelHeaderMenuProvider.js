import { __read } from "tslib";
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getPanelMenu } from '../../utils/getPanelMenu';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
export var PanelHeaderMenuProvider = function (_a) {
    var panel = _a.panel, dashboard = _a.dashboard, children = _a.children;
    var _b = __read(useState([]), 2), items = _b[0], setItems = _b[1];
    var angularComponent = useSelector(function (state) { var _a; return (_a = getPanelStateForModel(state, panel)) === null || _a === void 0 ? void 0 : _a.angularComponent; });
    useEffect(function () {
        setItems(getPanelMenu(dashboard, panel, angularComponent));
    }, [dashboard, panel, angularComponent, setItems]);
    return children({ items: items });
};
//# sourceMappingURL=PanelHeaderMenuProvider.js.map