import React, { useState } from 'react';
import semver from 'semver/preload';
import { onUpdateDatasourceJsonDataOptionChecked, updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { getBackendSrv } from '@grafana/runtime/src';
import { InlineField, Input, Select, Switch, useTheme2 } from '@grafana/ui';
import { useUpdateDatasource } from '../../../../features/datasources/state';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { defaultPrometheusQueryOverlapWindow } from '../querycache/QueryCache';
import { PromApplication, PrometheusCacheLevel } from '../types';
import { docsTip, overhaulStyles, PROM_CONFIG_LABEL_WIDTH, validateInput } from './ConfigEditor';
import { ExemplarsSettings } from './ExemplarsSettings';
import { PromFlavorVersions } from './PromFlavorVersions';
const httpOptions = [
    { value: 'POST', label: 'POST' },
    { value: 'GET', label: 'GET' },
];
const editorOptions = [
    { value: QueryEditorMode.Builder, label: 'Builder' },
    { value: QueryEditorMode.Code, label: 'Code' },
];
const cacheValueOptions = [
    { value: PrometheusCacheLevel.Low, label: 'Low' },
    { value: PrometheusCacheLevel.Medium, label: 'Medium' },
    { value: PrometheusCacheLevel.High, label: 'High' },
    { value: PrometheusCacheLevel.None, label: 'None' },
];
const prometheusFlavorSelectItems = [
    { value: PromApplication.Prometheus, label: PromApplication.Prometheus },
    { value: PromApplication.Cortex, label: PromApplication.Cortex },
    { value: PromApplication.Mimir, label: PromApplication.Mimir },
    { value: PromApplication.Thanos, label: PromApplication.Thanos },
];
// single duration input
export const DURATION_REGEX = /^$|^\d+(ms|[Mwdhmsy])$/;
// multiple duration input
export const MULTIPLE_DURATION_REGEX = /(\d+)(.+)/;
const durationError = 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s';
/**
 * Returns the closest version to what the user provided that we have in our PromFlavorVersions for the currently selected flavor
 * Bugs: It will only reject versions that are a major release apart, so Mimir 2.x might get selected for Prometheus 2.8 if the user selects an incorrect flavor
 * Advantages: We don't need to maintain a list of every possible version for each release
 *
 * This function will return the closest version from PromFlavorVersions that is equal or lower to the version argument
 */
const getVersionString = (version, flavor) => {
    if (!flavor || !PromFlavorVersions[flavor]) {
        return;
    }
    const flavorVersionValues = PromFlavorVersions[flavor];
    // As long as it's assured we're using versions which are sorted, we could just filter out the values greater than the target version, and then check the last element in the array
    const versionsLessThanOrEqual = flavorVersionValues === null || flavorVersionValues === void 0 ? void 0 : flavorVersionValues.filter((el) => !!el.value && semver.lte(el.value, version)).map((el) => el.value);
    const closestVersion = versionsLessThanOrEqual[versionsLessThanOrEqual.length - 1];
    if (closestVersion) {
        const differenceBetweenActualAndClosest = semver.diff(closestVersion, version);
        // Only return versions if the target is close to the actual.
        if (['patch', 'prepatch', 'prerelease', null].includes(differenceBetweenActualAndClosest)) {
            return closestVersion;
        }
    }
    return;
};
const unableToDeterminePrometheusVersion = (error) => {
    console.warn('Error fetching version from buildinfo API, must manually select version!', error);
};
/**
 * I don't like the daisy chain of network requests, and that we have to save on behalf of the user, but currently
 * the backend doesn't allow for the prometheus client url to be passed in from the frontend, so we currently need to save it
 * to the database before consumption.
 *
 * Since the prometheus version fields are below the url field, we can expect users to populate this field before
 * hitting save and test at the bottom of the page. For this case we need to save the current fields before calling the
 * resource to auto-detect the version.
 *
 * @param options
 * @param onOptionsChange
 * @param onUpdate
 */
const setPrometheusVersion = (options, onOptionsChange, onUpdate) => {
    // This will save the current state of the form, as the url is needed for this API call to function
    onUpdate(options)
        .then((updatedOptions) => {
        getBackendSrv()
            .get(`/api/datasources/uid/${updatedOptions.uid}/resources/version-detect`)
            .then((rawResponse) => {
            var _a, _b;
            const rawVersionStringFromApi = (_b = (_a = rawResponse.data) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : '';
            if (rawVersionStringFromApi && semver.valid(rawVersionStringFromApi)) {
                const parsedVersion = getVersionString(rawVersionStringFromApi, updatedOptions.jsonData.prometheusType);
                // If we got a successful response, let's update the backend with the version right away if it's new
                if (parsedVersion) {
                    onUpdate(Object.assign(Object.assign({}, updatedOptions), { jsonData: Object.assign(Object.assign({}, updatedOptions.jsonData), { prometheusVersion: parsedVersion }) })).then((updatedUpdatedOptions) => {
                        onOptionsChange(updatedUpdatedOptions);
                    });
                }
            }
            else {
                unableToDeterminePrometheusVersion();
            }
        });
    })
        .catch((error) => {
        unableToDeterminePrometheusVersion(error);
    });
};
export const PromSettings = (props) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const { options, onOptionsChange } = props;
    // This update call is typed as void, but it returns a response which we need
    const onUpdate = useUpdateDatasource();
    // We are explicitly adding httpMethod so, it is correctly displayed in dropdown.
    // This way, it is more predictable for users.
    if (!options.jsonData.httpMethod) {
        options.jsonData.httpMethod = 'POST';
    }
    const theme = useTheme2();
    const styles = overhaulStyles(theme);
    const [validDuration, updateValidDuration] = useState({
        timeInterval: '',
        queryTimeout: '',
        incrementalQueryOverlapWindow: '',
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(ConfigSubSection, { title: "Interval behaviour", className: styles.container },
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineField, { label: "Scrape interval", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                                "This interval is how frequently Prometheus scrapes targets. Set this to the typical scrape and evaluation interval configured in your Prometheus config file. If you set this to a greater value than your Prometheus config file interval, Grafana will evaluate the data according to this interval and you will see less data points. Defaults to 15s. ",
                                docsTip()), interactive: true, disabled: options.readOnly },
                            React.createElement(React.Fragment, null,
                                React.createElement(Input, { className: "width-20", value: options.jsonData.timeInterval, spellCheck: false, placeholder: "15s", onChange: onChangeHandler('timeInterval', options, onOptionsChange), onBlur: (e) => updateValidDuration(Object.assign(Object.assign({}, validDuration), { timeInterval: e.currentTarget.value })) }),
                                validateInput(validDuration.timeInterval, DURATION_REGEX, durationError))))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineField, { label: "Query timeout", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                                "Set the Prometheus query timeout. ",
                                docsTip()), interactive: true, disabled: options.readOnly },
                            React.createElement(React.Fragment, null,
                                React.createElement(Input, { className: "width-20", value: options.jsonData.queryTimeout, onChange: onChangeHandler('queryTimeout', options, onOptionsChange), spellCheck: false, placeholder: "60s", onBlur: (e) => updateValidDuration(Object.assign(Object.assign({}, validDuration), { queryTimeout: e.currentTarget.value })) }),
                                validateInput(validDuration.queryTimeout, DURATION_REGEX, durationError))))))),
        React.createElement(ConfigSubSection, { title: "Query editor", className: styles.container },
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineField, { label: "Default editor", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                            "Set default editor option for all users of this data source. ",
                            docsTip()), interactive: true, disabled: options.readOnly },
                        React.createElement(Select, { "aria-label": `Default Editor (Code or Builder)`, options: editorOptions, value: (_a = editorOptions.find((o) => o.value === options.jsonData.defaultEditor)) !== null && _a !== void 0 ? _a : editorOptions.find((o) => o.value === QueryEditorMode.Builder), onChange: onChangeHandler('defaultEditor', options, onOptionsChange), width: 40 }))),
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineField, { labelWidth: PROM_CONFIG_LABEL_WIDTH, label: "Disable metrics lookup", tooltip: React.createElement(React.Fragment, null,
                            "Checking this option will disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with bigger Prometheus instances.",
                            ' ',
                            docsTip()), interactive: true, disabled: options.readOnly, className: styles.switchField },
                        React.createElement(Switch, { value: (_b = options.jsonData.disableMetricsLookup) !== null && _b !== void 0 ? _b : false, onChange: onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup') }))))),
        React.createElement(ConfigSubSection, { title: "Performance", className: styles.container },
            !options.jsonData.prometheusType && !options.jsonData.prometheusVersion && options.readOnly && (React.createElement("div", { className: styles.versionMargin },
                "For more information on configuring prometheus type and version in data sources, see the",
                ' ',
                React.createElement("a", { className: styles.textUnderline, href: "https://grafana.com/docs/grafana/latest/administration/provisioning/" }, "provisioning documentation"),
                ".")),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineField, { label: "Prometheus type", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                                "Set this to the type of your prometheus database, e.g. Prometheus, Cortex, Mimir or Thanos. Changing this field will save your current settings, and attempt to detect the version. Certain types of Prometheus support or do not support various APIs. For example, some types support regex matching for label queries to improve performance. Some types have an API for metadata. If you set this incorrectly you may experience odd behavior when querying metrics and labels. Please check your Prometheus documentation to ensure you enter the correct type. ",
                                docsTip()), interactive: true, disabled: options.readOnly },
                            React.createElement(Select, { "aria-label": "Prometheus type", options: prometheusFlavorSelectItems, value: prometheusFlavorSelectItems.find((o) => o.value === options.jsonData.prometheusType), onChange: onChangeHandler('prometheusType', Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { prometheusVersion: undefined }) }), (options) => {
                                    // Check buildinfo api and set default version if we can
                                    setPrometheusVersion(options, onOptionsChange, onUpdate);
                                    return onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { prometheusVersion: undefined }) }));
                                }), width: 40 })))),
                React.createElement("div", { className: "gf-form-inline" }, options.jsonData.prometheusType && (React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineField, { label: `${options.jsonData.prometheusType} version`, labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                            "Use this to set the version of your ",
                            options.jsonData.prometheusType,
                            " instance if it is not automatically configured. ",
                            docsTip()), interactive: true, disabled: options.readOnly },
                        React.createElement(Select, { "aria-label": `${options.jsonData.prometheusType} type`, options: PromFlavorVersions[options.jsonData.prometheusType], value: (_c = PromFlavorVersions[options.jsonData.prometheusType]) === null || _c === void 0 ? void 0 : _c.find((o) => o.value === options.jsonData.prometheusVersion), onChange: onChangeHandler('prometheusVersion', options, onOptionsChange), width: 40 }))))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form max-width-30" },
                        React.createElement(InlineField, { label: "Cache level", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null, "Sets the browser caching level for editor queries. Higher cache settings are recommended for high cardinality data sources."), interactive: true, disabled: options.readOnly },
                            React.createElement(Select, { width: 40, onChange: onChangeHandler('cacheLevel', options, onOptionsChange), options: cacheValueOptions, value: (_d = cacheValueOptions.find((o) => o.value === options.jsonData.cacheLevel)) !== null && _d !== void 0 ? _d : PrometheusCacheLevel.Low })))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form max-width-30" },
                        React.createElement(InlineField, { label: "Incremental querying (beta)", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null, "This feature will change the default behavior of relative queries to always request fresh data from the prometheus instance, instead query results will be cached, and only new records are requested. Turn this on to decrease database and network load."), interactive: true, className: styles.switchField, disabled: options.readOnly },
                            React.createElement(Switch, { value: (_e = options.jsonData.incrementalQuerying) !== null && _e !== void 0 ? _e : false, onChange: onUpdateDatasourceJsonDataOptionChecked(props, 'incrementalQuerying') })))),
                React.createElement("div", { className: "gf-form-inline" }, options.jsonData.incrementalQuerying && (React.createElement(InlineField, { label: "Query overlap window", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null, "Set a duration like 10m or 120s or 0s. Default of 10 minutes. This duration will be added to the duration of each incremental request."), interactive: true, disabled: options.readOnly },
                    React.createElement(React.Fragment, null,
                        React.createElement(Input, { onBlur: (e) => updateValidDuration(Object.assign(Object.assign({}, validDuration), { incrementalQueryOverlapWindow: e.currentTarget.value })), className: "width-20", value: (_f = options.jsonData.incrementalQueryOverlapWindow) !== null && _f !== void 0 ? _f : defaultPrometheusQueryOverlapWindow, onChange: onChangeHandler('incrementalQueryOverlapWindow', options, onOptionsChange), spellCheck: false }),
                        validateInput(validDuration.incrementalQueryOverlapWindow, MULTIPLE_DURATION_REGEX, durationError))))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form max-width-30" },
                        React.createElement(InlineField, { label: "Disable recording rules (beta)", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null, "This feature will disable recording rules Turn this on to improve dashboard performance"), interactive: true, className: styles.switchField, disabled: options.readOnly },
                            React.createElement(Switch, { value: (_g = options.jsonData.disableRecordingRules) !== null && _g !== void 0 ? _g : false, onChange: onUpdateDatasourceJsonDataOptionChecked(props, 'disableRecordingRules') })))))),
        React.createElement(ConfigSubSection, { title: "Other", className: styles.container },
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form max-width-30" },
                        React.createElement(InlineField, { label: "Custom query parameters", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                                "Add custom parameters to the Prometheus query URL. For example timeout, partial_response, dedup, or max_source_resolution. Multiple parameters should be concatenated together with an \u2018&\u2019. ",
                                docsTip()), interactive: true, disabled: options.readOnly },
                            React.createElement(Input, { className: "width-20", value: options.jsonData.customQueryParameters, onChange: onChangeHandler('customQueryParameters', options, onOptionsChange), spellCheck: false, placeholder: "Example: max_source_resolution=5m&timeout=10" })))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineField, { labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                                "You can use either POST or GET HTTP method to query your Prometheus data source. POST is the recommended method as it allows bigger queries. Change this to GET if you have a Prometheus version older than 2.1 or if POST requests are restricted in your network. ",
                                docsTip()), interactive: true, label: "HTTP method", disabled: options.readOnly },
                            React.createElement(Select, { width: 40, "aria-label": "Select HTTP method", options: httpOptions, value: httpOptions.find((o) => o.value === options.jsonData.httpMethod), onChange: onChangeHandler('httpMethod', options, onOptionsChange) })))))),
        React.createElement(ExemplarsSettings, { options: options.jsonData.exemplarTraceIdDestinations, onChange: (exemplarOptions) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'exemplarTraceIdDestinations', exemplarOptions), disabled: options.readOnly })));
};
export const getValueFromEventItem = (eventItem) => {
    if (!eventItem) {
        return '';
    }
    if (eventItem.hasOwnProperty('currentTarget')) {
        return eventItem.currentTarget.value;
    }
    return eventItem.value;
};
const onChangeHandler = (key, options, onOptionsChange) => (eventItem) => {
    onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { [key]: getValueFromEventItem(eventItem) }) }));
};
//# sourceMappingURL=PromSettings.js.map