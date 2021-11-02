import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { useStyles } from '../../themes';
/**
 * @internal
 */
export var LoadingIndicator = function (_a) {
    var _b;
    var onCancel = _a.onCancel, loading = _a.loading;
    var styles = useStyles(getStyles);
    if (!loading) {
        return null;
    }
    return (React.createElement(Tooltip, { content: "Cancel query" },
        React.createElement(Icon, { className: cx('spin-clockwise', (_b = {}, _b[styles.clickable] = !!onCancel, _b)), name: "sync", size: "sm", onClick: onCancel, "aria-label": selectors.components.LoadingIndicator.icon })));
};
var getStyles = function () {
    return {
        clickable: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      cursor: pointer;\n    "], ["\n      cursor: pointer;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=LoadingIndicator.js.map