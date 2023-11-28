import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { isValidGoDuration, toOption } from '@grafana/data';
import { getTemplateSrv, isFetchError } from '@grafana/runtime';
import { InlineFieldRow, InlineField, Input, Alert, useStyles2, fuzzyMatch, Select } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { DEFAULT_LIMIT } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { TagsField } from './TagsField/TagsField';
const durationPlaceholder = 'e.g. 1.2s, 100ms';
const NativeSearch = ({ datasource, query, onChange, onBlur, onRunQuery }) => {
    const styles = useStyles2(getStyles);
    const languageProvider = useMemo(() => new TempoLanguageProvider(datasource), [datasource]);
    const [serviceOptions, setServiceOptions] = useState();
    const [spanOptions, setSpanOptions] = useState();
    const [error, setError] = useState(null);
    const [inputErrors, setInputErrors] = useState({});
    const [isLoading, setIsLoading] = useState({
        serviceName: false,
        spanName: false,
    });
    const loadOptions = useCallback((name, query = '') => __awaiter(void 0, void 0, void 0, function* () {
        const lpName = name === 'serviceName' ? 'service.name' : 'name';
        setIsLoading((prevValue) => (Object.assign(Object.assign({}, prevValue), { [name]: true })));
        try {
            const options = yield languageProvider.getOptionsV1(lpName);
            const filteredOptions = options.filter((item) => (item.value ? fuzzyMatch(item.value, query).found : false));
            return filteredOptions;
        }
        catch (error) {
            if (isFetchError(error) && (error === null || error === void 0 ? void 0 : error.status) === 404) {
                setError(error);
            }
            else if (error instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Error', error)));
            }
            return [];
        }
        finally {
            setIsLoading((prevValue) => (Object.assign(Object.assign({}, prevValue), { [name]: false })));
        }
    }), [languageProvider]);
    useEffect(() => {
        const fetchOptions = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const [services, spans] = yield Promise.all([loadOptions('serviceName'), loadOptions('spanName')]);
                if (query.serviceName && getTemplateSrv().containsTemplate(query.serviceName)) {
                    services.push(toOption(query.serviceName));
                }
                setServiceOptions(services);
                if (query.spanName && getTemplateSrv().containsTemplate(query.spanName)) {
                    spans.push(toOption(query.spanName));
                }
                setSpanOptions(spans);
            }
            catch (error) {
                // Display message if Tempo is connected but search 404's
                if (isFetchError(error) && (error === null || error === void 0 ? void 0 : error.status) === 404) {
                    setError(error);
                }
                else if (error instanceof Error) {
                    dispatch(notifyApp(createErrorNotification('Error', error)));
                }
            }
        });
        fetchOptions();
    }, [languageProvider, loadOptions, query.serviceName, query.spanName]);
    const onKeyDown = (keyEvent) => {
        if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
            onRunQuery();
        }
    };
    const handleOnChange = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, query), { search: value }));
    }, [onChange, query]);
    const templateSrv = getTemplateSrv();
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container },
            React.createElement(Alert, { title: "Deprecated query type", severity: "warning" }, "This query type has been deprecated and will be removed in Grafana v10.3. Please migrate to another Tempo query type."),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Service Name", labelWidth: 14, grow: true },
                    React.createElement(Select, { inputId: "service", options: serviceOptions, onOpenMenu: () => {
                            loadOptions('serviceName');
                        }, isLoading: isLoading.serviceName, value: (serviceOptions === null || serviceOptions === void 0 ? void 0 : serviceOptions.find((v) => (v === null || v === void 0 ? void 0 : v.value) === query.serviceName)) || query.serviceName, onChange: (v) => {
                            onChange(Object.assign(Object.assign({}, query), { serviceName: v === null || v === void 0 ? void 0 : v.value }));
                        }, placeholder: "Select a service", isClearable: true, onKeyDown: onKeyDown, "aria-label": 'select-service-name', allowCustomValue: true }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Span Name", labelWidth: 14, grow: true },
                    React.createElement(Select, { inputId: "spanName", options: spanOptions, onOpenMenu: () => {
                            loadOptions('spanName');
                        }, isLoading: isLoading.spanName, value: (spanOptions === null || spanOptions === void 0 ? void 0 : spanOptions.find((v) => (v === null || v === void 0 ? void 0 : v.value) === query.spanName)) || query.spanName, onChange: (v) => {
                            onChange(Object.assign(Object.assign({}, query), { spanName: v === null || v === void 0 ? void 0 : v.value }));
                        }, placeholder: "Select a span", isClearable: true, onKeyDown: onKeyDown, "aria-label": 'select-span-name', allowCustomValue: true }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Tags", labelWidth: 14, grow: true, tooltip: "Values should be in logfmt." },
                    React.createElement(TagsField, { placeholder: "http.status_code=200 error=true", value: query.search || '', onChange: handleOnChange, onBlur: onBlur, datasource: datasource }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Min Duration", invalid: !!inputErrors.minDuration, labelWidth: 14, grow: true },
                    React.createElement(Input, { id: "minDuration", value: query.minDuration || '', placeholder: durationPlaceholder, onBlur: () => {
                            var _a;
                            const templatedMinDuration = templateSrv.replace((_a = query.minDuration) !== null && _a !== void 0 ? _a : '');
                            if (query.minDuration && !isValidGoDuration(templatedMinDuration)) {
                                setInputErrors(Object.assign(Object.assign({}, inputErrors), { minDuration: true }));
                            }
                            else {
                                setInputErrors(Object.assign(Object.assign({}, inputErrors), { minDuration: false }));
                            }
                        }, onChange: (v) => onChange(Object.assign(Object.assign({}, query), { minDuration: v.currentTarget.value })), onKeyDown: onKeyDown }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Max Duration", invalid: !!inputErrors.maxDuration, labelWidth: 14, grow: true },
                    React.createElement(Input, { id: "maxDuration", value: query.maxDuration || '', placeholder: durationPlaceholder, onBlur: () => {
                            var _a;
                            const templatedMaxDuration = templateSrv.replace((_a = query.maxDuration) !== null && _a !== void 0 ? _a : '');
                            if (query.maxDuration && !isValidGoDuration(templatedMaxDuration)) {
                                setInputErrors(Object.assign(Object.assign({}, inputErrors), { maxDuration: true }));
                            }
                            else {
                                setInputErrors(Object.assign(Object.assign({}, inputErrors), { maxDuration: false }));
                            }
                        }, onChange: (v) => onChange(Object.assign(Object.assign({}, query), { maxDuration: v.currentTarget.value })), onKeyDown: onKeyDown }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Limit", invalid: !!inputErrors.limit, labelWidth: 14, grow: true, tooltip: "Maximum number of returned results" },
                    React.createElement(Input, { id: "limit", value: query.limit || '', placeholder: `Default: ${DEFAULT_LIMIT}`, type: "number", onChange: (v) => {
                            let limit = v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined;
                            if (limit && (!Number.isInteger(limit) || limit <= 0)) {
                                setInputErrors(Object.assign(Object.assign({}, inputErrors), { limit: true }));
                            }
                            else {
                                setInputErrors(Object.assign(Object.assign({}, inputErrors), { limit: false }));
                            }
                            onChange(Object.assign(Object.assign({}, query), { limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined }));
                        }, onKeyDown: onKeyDown })))),
        error ? (React.createElement(Alert, { title: "Unable to connect to Tempo search", severity: "info", className: styles.alert },
            "Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can configure it in the ",
            React.createElement("a", { href: `/datasources/edit/${datasource.uid}` }, "datasource settings"),
            ".")) : null));
};
export default NativeSearch;
const getStyles = (theme) => ({
    container: css `
    max-width: 500px;
  `,
    alert: css `
    max-width: 75ch;
    margin-top: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=NativeSearch.js.map