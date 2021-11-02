import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Alert, useTheme2 } from '@grafana/ui';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
import { css } from '@emotion/css';
export var ErrorContainer = function (props) {
    var _a;
    var queryError = props.queryError;
    var theme = useTheme2();
    var showError = queryError ? true : false;
    var duration = showError ? 100 : 10;
    var title = queryError ? 'Query error' : 'Unknown error';
    var message = (queryError === null || queryError === void 0 ? void 0 : queryError.message) || ((_a = queryError === null || queryError === void 0 ? void 0 : queryError.data) === null || _a === void 0 ? void 0 : _a.message) || null;
    var alertWithTopMargin = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(2));
    return (React.createElement(FadeIn, { in: showError, duration: duration },
        React.createElement(Alert, { severity: "error", title: title, className: alertWithTopMargin }, message)));
};
var templateObject_1;
//# sourceMappingURL=ErrorContainer.js.map