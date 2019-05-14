import React from 'react';
export var LayoutModes;
(function (LayoutModes) {
    LayoutModes["Grid"] = "grid";
    LayoutModes["List"] = "list";
})(LayoutModes || (LayoutModes = {}));
var LayoutSelector = function (props) {
    var mode = props.mode, onLayoutModeChanged = props.onLayoutModeChanged;
    return (React.createElement("div", { className: "layout-selector" },
        React.createElement("button", { onClick: function () {
                onLayoutModeChanged(LayoutModes.List);
            }, className: mode === LayoutModes.List ? 'active' : '' },
            React.createElement("i", { className: "fa fa-list" })),
        React.createElement("button", { onClick: function () {
                onLayoutModeChanged(LayoutModes.Grid);
            }, className: mode === LayoutModes.Grid ? 'active' : '' },
            React.createElement("i", { className: "fa fa-th" }))));
};
export default LayoutSelector;
//# sourceMappingURL=LayoutSelector.js.map