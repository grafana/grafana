import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { ConnectionConfig } from '@grafana/aws-sdk';
import { rangeUtil, onUpdateDatasourceJsonDataOption, updateDatasourcePluginJsonDataOption, DataSourceTestSucceeded, DataSourceTestFailed, } from '@grafana/data';
import { getAppEvents, usePluginInteractionReporter } from '@grafana/runtime';
import { Input, InlineField, SecureSocksProxySettings } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { config } from 'app/core/config';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/store';
import { CloudWatchDatasource } from '../../datasource';
import { LogGroupsFieldWrapper } from '../shared/LogGroups/LogGroupsField';
import { XrayLinkConfig } from './XrayLinkConfig';
export const ConfigEditor = (props) => {
    const { options, onOptionsChange } = props;
    const { defaultLogGroups, logsTimeout, defaultRegion, logGroups } = options.jsonData;
    const datasource = useDatasource(props);
    useAuthenticationWarning(options.jsonData);
    const logsTimeoutError = useTimoutValidation(logsTimeout);
    const saved = useDataSourceSavedState(props);
    const [logGroupFieldState, setLogGroupFieldState] = useState({
        invalid: false,
    });
    useEffect(() => setLogGroupFieldState({ invalid: false }), [props.options]);
    const report = usePluginInteractionReporter();
    useEffect(() => {
        const successSubscription = getAppEvents().subscribe(DataSourceTestSucceeded, () => {
            report('grafana_plugin_cloudwatch_save_succeeded', {
                auth_type: options.jsonData.authType,
            });
        });
        const failSubscription = getAppEvents().subscribe(DataSourceTestFailed, () => {
            report('grafana_plugin_cloudwatch_save_failed', {
                auth_type: options.jsonData.authType,
            });
        });
        return () => {
            successSubscription.unsubscribe();
            failSubscription.unsubscribe();
        };
    }, [options.jsonData.authType, report]);
    const [externalId, setExternalId] = useState('');
    useEffect(() => {
        if (!externalId && datasource) {
            datasource.resources
                .getExternalId()
                .then(setExternalId)
                .catch(() => setExternalId('Unable to fetch externalId'));
        }
    }, [datasource, externalId]);
    return (React.createElement(React.Fragment, null,
        React.createElement(ConnectionConfig, Object.assign({}, props, { labelWidth: 29, loadRegions: datasource &&
                (() => __awaiter(void 0, void 0, void 0, function* () {
                    return datasource.resources
                        .getRegions()
                        .then((regions) => regions.reduce((acc, curr) => (curr.value ? [...acc, curr.value] : acc), []));
                })), externalId: externalId }),
            React.createElement(InlineField, { label: "Namespaces of Custom Metrics", labelWidth: 29, tooltip: "Namespaces of Custom Metrics." },
                React.createElement(Input, { width: 60, placeholder: "Namespace1,Namespace2", value: options.jsonData.customMetricsNamespaces || '', onChange: onUpdateDatasourceJsonDataOption(props, 'customMetricsNamespaces') }))),
        config.secureSocksDSProxyEnabled && (React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange })),
        React.createElement("h3", { className: "page-heading" }, "CloudWatch Logs"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(InlineField, { label: "Query Result Timeout", labelWidth: 28, tooltip: 'Grafana will poll for Cloudwatch Logs query results every second until Done status is returned from AWS or timeout is exceeded, in which case Grafana will return an error. The default period is 30 minutes. Note: For Alerting, the timeout defined in the config file will take precedence. Must be a valid duration string, such as "15m" "30s" "2000ms" etc.', invalid: Boolean(logsTimeoutError) },
                React.createElement(Input, { width: 60, placeholder: "30m", value: options.jsonData.logsTimeout || '', onChange: onUpdateDatasourceJsonDataOption(props, 'logsTimeout'), title: 'The timeout must be a valid duration string, such as "15m" "30s" "2000ms" etc.' })),
            React.createElement(InlineField, Object.assign({ label: "Default Log Groups", labelWidth: 28, tooltip: "Optionally, specify default log groups for CloudWatch Logs queries.", shrink: true }, logGroupFieldState), datasource ? (React.createElement(LogGroupsFieldWrapper, { region: defaultRegion !== null && defaultRegion !== void 0 ? defaultRegion : '', datasource: datasource, onBeforeOpen: () => {
                    if (saved) {
                        return;
                    }
                    let error = 'You need to save the data source before adding log groups.';
                    if (props.options.version && props.options.version > 1) {
                        error =
                            'You have unsaved connection detail changes. You need to save the data source before adding log groups.';
                    }
                    setLogGroupFieldState({
                        invalid: true,
                        error,
                    });
                    throw new Error(error);
                }, legacyLogGroupNames: defaultLogGroups, logGroups: logGroups, onChange: (updatedLogGroups) => {
                    onOptionsChange(Object.assign(Object.assign({}, props.options), { jsonData: Object.assign(Object.assign({}, props.options.jsonData), { logGroups: updatedLogGroups, defaultLogGroups: undefined }) }));
                }, maxNoOfVisibleLogGroups: 2, 
                //legacy props
                legacyOnChange: (logGroups) => {
                    updateDatasourcePluginJsonDataOption(props, 'defaultLogGroups', logGroups);
                } })) : (React.createElement(React.Fragment, null)))),
        React.createElement(XrayLinkConfig, { onChange: (uid) => updateDatasourcePluginJsonDataOption(props, 'tracingDatasourceUid', uid), datasourceUid: options.jsonData.tracingDatasourceUid })));
};
function useAuthenticationWarning(jsonData) {
    const addWarning = (message) => {
        store.dispatch(notifyApp(createWarningNotification('CloudWatch Authentication', message)));
    };
    useEffect(() => {
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
function useDatasource(props) {
    const [datasource, setDatasource] = useState();
    useEffect(() => {
        if (props.options.version) {
            getDatasourceSrv()
                .loadDatasource(props.options.name)
                .then((datasource) => {
                if (datasource instanceof CloudWatchDatasource) {
                    setDatasource(datasource);
                }
            });
        }
    }, [props.options.version, props.options.name]);
    return datasource;
}
function useTimoutValidation(value) {
    const [err, setErr] = useState(undefined);
    useDebounce(() => {
        if (value) {
            try {
                rangeUtil.describeInterval(value);
                setErr(undefined);
            }
            catch (e) {
                if (e instanceof Error) {
                    setErr(e.toString());
                }
            }
        }
        else {
            setErr(undefined);
        }
    }, 350, [value]);
    return err;
}
function useDataSourceSavedState(props) {
    var _a, _b;
    const [saved, setSaved] = useState(!!props.options.version && props.options.version > 1);
    useEffect(() => {
        setSaved(false);
    }, [
        props.options.jsonData.assumeRoleArn,
        props.options.jsonData.authType,
        props.options.jsonData.defaultRegion,
        props.options.jsonData.endpoint,
        props.options.jsonData.externalId,
        props.options.jsonData.profile,
        (_a = props.options.secureJsonData) === null || _a === void 0 ? void 0 : _a.accessKey,
        (_b = props.options.secureJsonData) === null || _b === void 0 ? void 0 : _b.secretKey,
    ]);
    useEffect(() => {
        props.options.version && props.options.version > 1 && setSaved(true);
    }, [props.options.version]);
    return saved;
}
//# sourceMappingURL=ConfigEditor.js.map