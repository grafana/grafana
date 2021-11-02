import { __assign, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { Input, InlineField } from '@grafana/ui';
import { onUpdateDatasourceJsonDataOption, updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { ConnectionConfig } from '@grafana/aws-sdk';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { XrayLinkConfig } from './XrayLinkConfig';
export var ConfigEditor = function (props) {
    var options = props.options;
    var datasource = useDatasource(options.name);
    useAuthenticationWarning(options.jsonData);
    return (React.createElement(React.Fragment, null,
        React.createElement(ConnectionConfig, __assign({}, props, { loadRegions: datasource &&
                (function () { return datasource.getRegions().then(function (r) { return r.filter(function (r) { return r.value !== 'default'; }).map(function (v) { return v.value; }); }); }) }),
            React.createElement(InlineField, { label: "Namespaces of Custom Metrics", labelWidth: 28, tooltip: "Namespaces of Custom Metrics." },
                React.createElement(Input, { width: 60, placeholder: "Namespace1,Namespace2", value: options.jsonData.customMetricsNamespaces || '', onChange: onUpdateDatasourceJsonDataOption(props, 'customMetricsNamespaces') }))),
        React.createElement(XrayLinkConfig, { onChange: function (uid) { return updateDatasourcePluginJsonDataOption(props, 'tracingDatasourceUid', uid); }, datasourceUid: options.jsonData.tracingDatasourceUid })));
};
function useAuthenticationWarning(jsonData) {
    var addWarning = function (message) {
        store.dispatch(notifyApp(createWarningNotification('CloudWatch Authentication', message)));
    };
    useEffect(function () {
        if (jsonData.authType === 'arn') {
            addWarning('Since grafana 7.3 authentication type "arn" is deprecated, falling back to default SDK provider');
        }
        else if (jsonData.authType === 'credentials' && !jsonData.profile && !jsonData.database) {
            addWarning('As of grafana 7.3 authentication type "credentials" should be used only for shared file credentials. \
             If you don\'t have a credentials file, switch to the default SDK provider for extracting credentials \
             from environment variables or IAM roles');
        }
    }, [jsonData.authType, jsonData.database, jsonData.profile]);
}
function useDatasource(datasourceName) {
    var _a = __read(useState(), 2), datasource = _a[0], setDatasource = _a[1];
    useEffect(function () {
        getDatasourceSrv()
            .loadDatasource(datasourceName)
            .then(function (datasource) { return setDatasource(datasource); });
    }, [datasourceName]);
    return datasource;
}
//# sourceMappingURL=ConfigEditor.js.map