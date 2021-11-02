import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { startCase } from 'lodash';
import { Button, FileUpload, InlineField, Input, useStyles, Alert } from '@grafana/ui';
import { css, cx } from '@emotion/css';
var configKeys = ['project_id', 'private_key', 'client_email', 'token_uri'];
var validateJson = function (json) {
    return !!json.token_uri && !!json.client_email && !!json.project_id && !!json.project_id;
};
export function JWTConfig(_a) {
    var onChange = _a.onChange, isConfigured = _a.isConfigured;
    var styles = useStyles(getStyles);
    var _b = __read(useState(!isConfigured), 2), enableUpload = _b[0], setEnableUpload = _b[1];
    var _c = __read(useState(null), 2), error = _c[0], setError = _c[1];
    return enableUpload ? (React.createElement(React.Fragment, null,
        React.createElement(FileUpload, { className: styles, accept: "application/json", onFileUpload: function (event) {
                var _a, _b;
                if (((_b = (_a = event === null || event === void 0 ? void 0 : event.currentTarget) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b.length) === 1) {
                    setError(null);
                    var reader = new FileReader();
                    var readerOnLoad = function () {
                        return function (e) {
                            var json = JSON.parse(e.target.result);
                            if (validateJson(json)) {
                                onChange(json);
                                setEnableUpload(false);
                            }
                            else {
                                setError('Invalid JWT file');
                            }
                        };
                    };
                    reader.onload = readerOnLoad();
                    reader.readAsText(event.currentTarget.files[0]);
                }
                else {
                    setError('You can only upload one file');
                }
            } }, "Upload service account key file"),
        error && React.createElement("p", { className: cx(styles, 'alert') }, error))) : (React.createElement(React.Fragment, null,
        configKeys.map(function (key, i) { return (React.createElement(InlineField, { label: startCase(key), key: i, labelWidth: 20, disabled: true },
            React.createElement(Input, { width: 40, placeholder: "configured" }))); }),
        React.createElement(Button, { variant: "secondary", onClick: function () { return setEnableUpload(true); }, className: styles }, "Upload another JWT file"),
        React.createElement(Alert, { title: "", className: styles, severity: "info" }, "Do not forget to save your changes after uploading a file")));
}
export var getStyles = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  margin: ", " 0 0;\n"], ["\n  margin: ", " 0 0;\n"])), theme.spacing.md); };
var templateObject_1;
//# sourceMappingURL=JWTConfig.js.map