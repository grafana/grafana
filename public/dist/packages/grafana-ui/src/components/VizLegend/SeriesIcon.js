import { __assign, __rest } from "tslib";
import React from 'react';
import { useTheme2 } from '../../themes';
import { fieldColorModeRegistry } from '@grafana/data';
export var SeriesIcon = React.forwardRef(function (_a, ref) {
    var _b, _c;
    var color = _a.color, className = _a.className, gradient = _a.gradient, restProps = __rest(_a, ["color", "className", "gradient"]);
    var theme = useTheme2();
    var cssColor;
    if (gradient) {
        var colors = (_c = (_b = fieldColorModeRegistry.get(gradient)).getColors) === null || _c === void 0 ? void 0 : _c.call(_b, theme);
        if (colors === null || colors === void 0 ? void 0 : colors.length) {
            cssColor = "linear-gradient(90deg, " + colors.join(', ') + ")";
        }
        else {
            // Not sure what to default to, this will return gray, this should not happen though.
            cssColor = theme.visualization.getColorByName('');
        }
    }
    else {
        cssColor = color;
    }
    var styles = {
        background: cssColor,
        width: '14px',
        height: '4px',
        borderRadius: '1px',
        display: 'inline-block',
        marginRight: '8px',
    };
    return React.createElement("div", __assign({ ref: ref, className: className, style: styles }, restProps));
});
SeriesIcon.displayName = 'SeriesIcon';
//# sourceMappingURL=SeriesIcon.js.map