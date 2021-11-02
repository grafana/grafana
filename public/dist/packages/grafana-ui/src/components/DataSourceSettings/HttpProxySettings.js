import { __assign } from "tslib";
import React from 'react';
import { Switch } from '../Forms/Legacy/Switch/Switch';
export var HttpProxySettings = function (_a) {
    var dataSourceConfig = _a.dataSourceConfig, onChange = _a.onChange, _b = _a.showForwardOAuthIdentityOption, showForwardOAuthIdentityOption = _b === void 0 ? true : _b;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement(Switch, { label: "TLS Client Auth", labelClass: "width-13", checked: dataSourceConfig.jsonData.tlsAuth || false, onChange: function (event) { return onChange(__assign(__assign({}, dataSourceConfig.jsonData), { tlsAuth: event.currentTarget.checked })); } }),
            React.createElement(Switch, { label: "With CA Cert", labelClass: "width-13", checked: dataSourceConfig.jsonData.tlsAuthWithCACert || false, onChange: function (event) {
                    return onChange(__assign(__assign({}, dataSourceConfig.jsonData), { tlsAuthWithCACert: event.currentTarget.checked }));
                }, tooltip: "Needed for verifying self-signed TLS Certs" })),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement(Switch, { label: "Skip TLS Verify", labelClass: "width-13", checked: dataSourceConfig.jsonData.tlsSkipVerify || false, onChange: function (event) { return onChange(__assign(__assign({}, dataSourceConfig.jsonData), { tlsSkipVerify: event.currentTarget.checked })); } })),
        showForwardOAuthIdentityOption && (React.createElement("div", { className: "gf-form-inline" },
            React.createElement(Switch, { label: "Forward OAuth Identity", labelClass: "width-13", checked: dataSourceConfig.jsonData.oauthPassThru || false, onChange: function (event) {
                    return onChange(__assign(__assign({}, dataSourceConfig.jsonData), { oauthPassThru: event.currentTarget.checked }));
                }, tooltip: "Forward the user's upstream OAuth identity to the data source (Their access token gets passed along)." })))));
};
//# sourceMappingURL=HttpProxySettings.js.map