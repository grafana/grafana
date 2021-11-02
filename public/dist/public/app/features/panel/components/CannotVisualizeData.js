import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles2 } from '../../../../../packages/grafana-ui/src';
import { css } from '@emotion/css';
export function CannotVisualizeData(_a) {
    var message = _a.message, suggestions = _a.suggestions;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.message }, message)));
}
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      height: 100%;\n      width: 100%;\n    "], ["\n      display: flex;\n      align-items: center;\n      height: 100%;\n      width: 100%;\n    "]))),
        message: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-align: center;\n      color: $text-muted;\n      font-size: $font-size-lg;\n      width: 100%;\n    "], ["\n      text-align: center;\n      color: $text-muted;\n      font-size: $font-size-lg;\n      width: 100%;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=CannotVisualizeData.js.map