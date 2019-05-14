import React from 'react';
import classNames from 'classnames';
var VizTypePickerPlugin = React.memo(function (_a) {
    var isCurrent = _a.isCurrent, plugin = _a.plugin, onClick = _a.onClick;
    var cssClass = classNames({
        'viz-picker__item': true,
        'viz-picker__item--current': isCurrent,
    });
    return (React.createElement("div", { className: cssClass, onClick: onClick, title: plugin.name },
        React.createElement("div", { className: "viz-picker__item-name" }, plugin.name),
        React.createElement("img", { className: "viz-picker__item-img", src: plugin.info.logos.small })));
}, function (prevProps, nextProps) {
    if (prevProps.isCurrent === nextProps.isCurrent) {
        return true;
    }
    return false;
});
export default VizTypePickerPlugin;
//# sourceMappingURL=VizTypePickerPlugin.js.map