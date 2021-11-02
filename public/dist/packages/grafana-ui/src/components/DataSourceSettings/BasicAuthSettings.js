import { __assign } from "tslib";
import React from 'react';
import { InlineField } from '../..';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormField/SecretFormField';
export var BasicAuthSettings = function (_a) {
    var dataSourceConfig = _a.dataSourceConfig, onChange = _a.onChange;
    var password = dataSourceConfig.secureJsonData ? dataSourceConfig.secureJsonData.basicAuthPassword : '';
    var onPasswordReset = function () {
        onChange(__assign(__assign({}, dataSourceConfig), { basicAuthPassword: '', secureJsonData: __assign(__assign({}, dataSourceConfig.secureJsonData), { basicAuthPassword: '' }), secureJsonFields: __assign(__assign({}, dataSourceConfig.secureJsonFields), { basicAuthPassword: false }) }));
    };
    var onPasswordChange = function (event) {
        onChange(__assign(__assign({}, dataSourceConfig), { secureJsonData: __assign(__assign({}, dataSourceConfig.secureJsonData), { basicAuthPassword: event.currentTarget.value }) }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, null,
            React.createElement(FormField, { label: "User", labelWidth: 10, inputWidth: 18, placeholder: "user", value: dataSourceConfig.basicAuthUser, onChange: function (event) { return onChange(__assign(__assign({}, dataSourceConfig), { basicAuthUser: event.currentTarget.value })); } })),
        React.createElement(InlineField, null,
            React.createElement(SecretFormField, { isConfigured: !!dataSourceConfig.basicAuthPassword ||
                    !!(dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.basicAuthPassword), value: password || '', inputWidth: 18, labelWidth: 10, onReset: onPasswordReset, onChange: onPasswordChange }))));
};
//# sourceMappingURL=BasicAuthSettings.js.map