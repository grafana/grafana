import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { Button, stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { useUrlParams } from 'app/core/navigation/hooks';
var getStyles = stylesFactory(function () {
    return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 508px;\n    margin: 128px auto;\n  "], ["\n    width: 508px;\n    margin: 128px auto;\n  "])));
});
export var ErrorLoadingChunk = function (_a) {
    var error = _a.error;
    var _b = __read(useUrlParams(), 2), params = _b[0], updateUrlParams = _b[1];
    if (!params.get('chunkNotFound')) {
        updateUrlParams({ chunkNotFound: true }, true);
        window.location.reload();
    }
    return (React.createElement("div", { className: getStyles() },
        React.createElement("h2", null, "Unable to find application file"),
        React.createElement("br", null),
        React.createElement("h2", { className: "page-heading" }, "Grafana has likely been updated. Please try reloading the page."),
        React.createElement("br", null),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(Button, { size: "md", variant: "secondary", icon: "repeat", onClick: function () { return window.location.reload(); } }, "Reload")),
        React.createElement("details", { style: { whiteSpace: 'pre-wrap' } },
            error && error.message ? error.message : 'Unexpected error occurred',
            React.createElement("br", null),
            error && error.stack ? error.stack : null)));
};
ErrorLoadingChunk.displayName = 'ErrorLoadingChunk';
var templateObject_1;
//# sourceMappingURL=ErrorLoadingChunk.js.map