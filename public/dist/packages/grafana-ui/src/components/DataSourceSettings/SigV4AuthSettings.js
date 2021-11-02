import { __assign } from "tslib";
import React from 'react';
import { ConnectionConfig, } from '@grafana/aws-sdk';
export var SigV4AuthSettings = function (props) {
    var _a, _b, _c, _d;
    var dataSourceConfig = props.dataSourceConfig, onChange = props.onChange;
    // The @grafana/aws-sdk ConnectionConfig is designed to be rendered in a ConfigEditor,
    // taking DataSourcePluginOptionsEditorProps as props. We therefore need to map the props accordingly.
    var connectionConfigProps = {
        onOptionsChange: function (awsDataSourceSettings) {
            var _a, _b, _c, _d;
            var dataSourceSettings = __assign(__assign({}, dataSourceConfig), { jsonData: __assign(__assign({}, dataSourceConfig.jsonData), { sigV4AuthType: awsDataSourceSettings.jsonData.authType, sigV4Profile: awsDataSourceSettings.jsonData.profile, sigV4AssumeRoleArn: awsDataSourceSettings.jsonData.assumeRoleArn, sigV4ExternalId: awsDataSourceSettings.jsonData.externalId, sigV4Region: awsDataSourceSettings.jsonData.defaultRegion, sigV4Endpoint: awsDataSourceSettings.jsonData.endpoint }), secureJsonFields: {
                    sigV4AccessKey: (_a = awsDataSourceSettings.secureJsonFields) === null || _a === void 0 ? void 0 : _a.accessKey,
                    sigV4SecretKey: (_b = awsDataSourceSettings.secureJsonFields) === null || _b === void 0 ? void 0 : _b.secretKey,
                }, secureJsonData: {
                    sigV4AccessKey: (_c = awsDataSourceSettings.secureJsonData) === null || _c === void 0 ? void 0 : _c.accessKey,
                    sigV4SecretKey: (_d = awsDataSourceSettings.secureJsonData) === null || _d === void 0 ? void 0 : _d.secretKey,
                } });
            onChange(dataSourceSettings);
        },
        options: __assign(__assign({}, dataSourceConfig), { jsonData: __assign(__assign({}, dataSourceConfig.jsonData), { authType: dataSourceConfig.jsonData.sigV4AuthType, profile: dataSourceConfig.jsonData.sigV4Profile, assumeRoleArn: dataSourceConfig.jsonData.sigV4AssumeRoleArn, externalId: dataSourceConfig.jsonData.sigV4ExternalId, defaultRegion: dataSourceConfig.jsonData.sigV4Region, endpoint: dataSourceConfig.jsonData.sigV4Endpoint }), secureJsonFields: {
                accessKey: (_a = dataSourceConfig.secureJsonFields) === null || _a === void 0 ? void 0 : _a.sigV4AccessKey,
                secretKey: (_b = dataSourceConfig.secureJsonFields) === null || _b === void 0 ? void 0 : _b.sigV4SecretKey,
            }, secureJsonData: {
                accessKey: (_c = dataSourceConfig.secureJsonData) === null || _c === void 0 ? void 0 : _c.sigV4AccessKey,
                secretKey: (_d = dataSourceConfig.secureJsonData) === null || _d === void 0 ? void 0 : _d.sigV4SecretKey,
            } }),
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form" },
            React.createElement("h6", null, "SigV4 Auth Details")),
        React.createElement(ConnectionConfig, __assign({}, connectionConfigProps, { skipHeader: true, skipEndpoint: true }))));
};
//# sourceMappingURL=SigV4AuthSettings.js.map