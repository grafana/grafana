import { __extends } from "tslib";
// Library
import React, { PureComponent } from 'react';
import { buildLayout } from './BigValueLayout';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';
export var BigValueColorMode;
(function (BigValueColorMode) {
    BigValueColorMode["Value"] = "value";
    BigValueColorMode["Background"] = "background";
    BigValueColorMode["None"] = "none";
})(BigValueColorMode || (BigValueColorMode = {}));
export var BigValueGraphMode;
(function (BigValueGraphMode) {
    BigValueGraphMode["None"] = "none";
    BigValueGraphMode["Line"] = "line";
    BigValueGraphMode["Area"] = "area";
})(BigValueGraphMode || (BigValueGraphMode = {}));
export var BigValueJustifyMode;
(function (BigValueJustifyMode) {
    BigValueJustifyMode["Auto"] = "auto";
    BigValueJustifyMode["Center"] = "center";
})(BigValueJustifyMode || (BigValueJustifyMode = {}));
/**
 * Options for how the value & title are to be displayed
 */
export var BigValueTextMode;
(function (BigValueTextMode) {
    BigValueTextMode["Auto"] = "auto";
    BigValueTextMode["Value"] = "value";
    BigValueTextMode["ValueAndName"] = "value_and_name";
    BigValueTextMode["Name"] = "name";
    BigValueTextMode["None"] = "none";
})(BigValueTextMode || (BigValueTextMode = {}));
var BigValue = /** @class */ (function (_super) {
    __extends(BigValue, _super);
    function BigValue() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BigValue.prototype.render = function () {
        var _a = this.props, onClick = _a.onClick, className = _a.className, hasLinks = _a.hasLinks;
        var layout = buildLayout(this.props);
        var panelStyles = layout.getPanelStyles();
        var valueAndTitleContainerStyles = layout.getValueAndTitleContainerStyles();
        var valueStyles = layout.getValueStyles();
        var titleStyles = layout.getTitleStyles();
        var textValues = layout.textValues;
        // When there is an outer data link this tooltip will override the outer native tooltip
        var tooltip = hasLinks ? undefined : textValues.tooltip;
        return (React.createElement("div", { className: className, style: panelStyles, onClick: onClick, title: tooltip },
            React.createElement("div", { style: valueAndTitleContainerStyles },
                textValues.title && React.createElement("div", { style: titleStyles }, textValues.title),
                React.createElement(FormattedValueDisplay, { value: textValues, style: valueStyles })),
            layout.renderChart()));
    };
    BigValue.defaultProps = {
        justifyMode: BigValueJustifyMode.Auto,
    };
    return BigValue;
}(PureComponent));
export { BigValue };
//# sourceMappingURL=BigValue.js.map