import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Portal } from '../Portal/Portal';
import { VizTooltipContainer } from './VizTooltipContainer';
import { useStyles } from '../../themes';
/**
 * @public
 */
export var VizTooltip = function (_a) {
    var content = _a.content, position = _a.position, offset = _a.offset;
    var styles = useStyles(getStyles);
    if (position) {
        return (React.createElement(Portal, { className: styles.portal },
            React.createElement(VizTooltipContainer, { position: position, offset: offset || { x: 0, y: 0 } }, content)));
    }
    return null;
};
VizTooltip.displayName = 'VizTooltip';
var getStyles = function () {
    return {
        portal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: absolute;\n      top: 0;\n      left: 0;\n      pointer-events: none;\n      width: 100%;\n      height: 100%;\n    "], ["\n      position: absolute;\n      top: 0;\n      left: 0;\n      pointer-events: none;\n      width: 100%;\n      height: 100%;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=VizTooltip.js.map