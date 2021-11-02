import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { CertificationKey } from './CertificationKey';
import { FormField } from '../FormField/FormField';
export var TLSAuthSettings = function (_a) {
    var dataSourceConfig = _a.dataSourceConfig, onChange = _a.onChange;
    var hasTLSCACert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsCACert;
    var hasTLSClientCert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientCert;
    var hasTLSClientKey = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientKey;
    var hasServerName = dataSourceConfig.jsonData && dataSourceConfig.jsonData.serverName;
    var onResetClickFactory = function (field) { return function (event) {
        event.preventDefault();
        var newSecureJsonFields = __assign({}, dataSourceConfig.secureJsonFields);
        newSecureJsonFields[field] = false;
        onChange(__assign(__assign({}, dataSourceConfig), { secureJsonFields: newSecureJsonFields }));
    }; };
    var onCertificateChangeFactory = function (field) { return function (event) {
        var newSecureJsonData = __assign({}, dataSourceConfig.secureJsonData);
        newSecureJsonData[field] = event.currentTarget.value;
        onChange(__assign(__assign({}, dataSourceConfig), { secureJsonData: newSecureJsonData }));
    }; };
    var onServerNameLabelChange = function (event) {
        var newJsonData = __assign(__assign({}, dataSourceConfig.jsonData), { serverName: event.currentTarget.value });
        onChange(__assign(__assign({}, dataSourceConfig), { jsonData: newJsonData }));
    };
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: cx('gf-form', css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            align-items: baseline;\n          "], ["\n            align-items: baseline;\n          "])))) },
            React.createElement("h6", null, "TLS/SSL Auth Details"),
            React.createElement(Tooltip, { placement: "right-end", content: "TLS/SSL Certs are encrypted and stored in the Grafana database.", theme: "info" },
                React.createElement("div", { className: "gf-form-help-icon gf-form-help-icon--right-normal" },
                    React.createElement(Icon, { name: "info-circle", size: "xs", style: { marginLeft: '10px' } })))),
        React.createElement("div", null,
            dataSourceConfig.jsonData.tlsAuthWithCACert && (React.createElement(CertificationKey, { hasCert: !!hasTLSCACert, onChange: onCertificateChangeFactory('tlsCACert'), placeholder: "Begins with -----BEGIN CERTIFICATE-----", label: "CA Cert", onClick: onResetClickFactory('tlsCACert') })),
            dataSourceConfig.jsonData.tlsAuth && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "gf-form" },
                    React.createElement(FormField, { label: "ServerName", labelWidth: 7, inputWidth: 30, placeholder: "domain.example.com", value: hasServerName && dataSourceConfig.jsonData.serverName, onChange: onServerNameLabelChange })),
                React.createElement(CertificationKey, { hasCert: !!hasTLSClientCert, label: "Client Cert", onChange: onCertificateChangeFactory('tlsClientCert'), placeholder: "Begins with -----BEGIN CERTIFICATE-----", onClick: onResetClickFactory('tlsClientCert') }),
                React.createElement(CertificationKey, { hasCert: !!hasTLSClientKey, label: "Client Key", placeholder: "Begins with -----BEGIN RSA PRIVATE KEY-----", onChange: onCertificateChangeFactory('tlsClientKey'), onClick: onResetClickFactory('tlsClientKey') }))))));
};
var templateObject_1;
//# sourceMappingURL=TLSAuthSettings.js.map