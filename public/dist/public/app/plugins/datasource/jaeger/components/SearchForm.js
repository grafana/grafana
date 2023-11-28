import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { toOption } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { fuzzyMatch, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { transformToLogfmt } from '../util';
const durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';
export const ALL_OPERATIONS_KEY = 'All';
const allOperationsOption = {
    label: ALL_OPERATIONS_KEY,
    value: undefined,
};
export function SearchForm({ datasource, query, onChange }) {
    const [serviceOptions, setServiceOptions] = useState();
    const [operationOptions, setOperationOptions] = useState();
    const [isLoading, setIsLoading] = useState({
        services: false,
        operations: false,
    });
    const loadOptions = useCallback((url, loaderOfType, query = '') => __awaiter(this, void 0, void 0, function* () {
        setIsLoading((prevValue) => (Object.assign(Object.assign({}, prevValue), { [loaderOfType]: true })));
        try {
            const values = yield datasource.metadataRequest(url);
            if (!values) {
                return [{ label: `No ${loaderOfType} found`, value: `No ${loaderOfType} found` }];
            }
            const options = values.sort().map((option) => ({
                label: option,
                value: option,
            }));
            const filteredOptions = options.filter((item) => (item.value ? fuzzyMatch(item.value, query).found : false));
            return filteredOptions;
        }
        catch (error) {
            if (error instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Error', error)));
            }
            return [];
        }
        finally {
            setIsLoading((prevValue) => (Object.assign(Object.assign({}, prevValue), { [loaderOfType]: false })));
        }
    }), [datasource]);
    useEffect(() => {
        const getServices = () => __awaiter(this, void 0, void 0, function* () {
            const services = yield loadOptions('/api/services', 'services');
            if (query.service && getTemplateSrv().containsTemplate(query.service)) {
                services.push(toOption(query.service));
            }
            setServiceOptions(services);
        });
        getServices();
    }, [datasource, loadOptions, query.service]);
    useEffect(() => {
        const getOperations = () => __awaiter(this, void 0, void 0, function* () {
            const operations = yield loadOptions(`/api/services/${encodeURIComponent(getTemplateSrv().replace(query.service))}/operations`, 'operations');
            if (query.operation && getTemplateSrv().containsTemplate(query.operation)) {
                operations.push(toOption(query.operation));
            }
            setOperationOptions([allOperationsOption, ...operations]);
        });
        if (query.service) {
            getOperations();
        }
    }, [datasource, query.service, loadOptions, query.operation]);
    return (React.createElement("div", { className: css({ maxWidth: '500px' }) },
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Service Name", labelWidth: 14, grow: true },
                React.createElement(Select, { inputId: "service", options: serviceOptions, onOpenMenu: () => loadOptions('/api/services', 'services'), isLoading: isLoading.services, value: (serviceOptions === null || serviceOptions === void 0 ? void 0 : serviceOptions.find((v) => (v === null || v === void 0 ? void 0 : v.value) === query.service)) || undefined, placeholder: "Select a service", onChange: (v) => onChange(Object.assign(Object.assign({}, query), { service: v === null || v === void 0 ? void 0 : v.value, operation: query.service !== (v === null || v === void 0 ? void 0 : v.value) ? undefined : query.operation })), menuPlacement: "bottom", isClearable: true, "aria-label": 'select-service-name', allowCustomValue: true }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Operation Name", labelWidth: 14, grow: true, disabled: !query.service },
                React.createElement(Select, { inputId: "operation", options: operationOptions, onOpenMenu: () => loadOptions(`/api/services/${encodeURIComponent(getTemplateSrv().replace(query.service))}/operations`, 'operations'), isLoading: isLoading.operations, value: (operationOptions === null || operationOptions === void 0 ? void 0 : operationOptions.find((v) => v.value === query.operation)) || null, placeholder: "Select an operation", onChange: (v) => onChange(Object.assign(Object.assign({}, query), { operation: (v === null || v === void 0 ? void 0 : v.value) || undefined })), menuPlacement: "bottom", isClearable: true, "aria-label": 'select-operation-name', allowCustomValue: true }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Tags", labelWidth: 14, grow: true, tooltip: "Values should be in logfmt." },
                React.createElement(Input, { id: "tags", value: transformToLogfmt(query.tags), placeholder: "http.status_code=200 error=true", onChange: (v) => onChange(Object.assign(Object.assign({}, query), { tags: v.currentTarget.value })) }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Min Duration", labelWidth: 14, grow: true },
                React.createElement(Input, { id: "minDuration", name: "minDuration", value: query.minDuration || '', placeholder: durationPlaceholder, onChange: (v) => onChange(Object.assign(Object.assign({}, query), { minDuration: v.currentTarget.value })) }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Max Duration", labelWidth: 14, grow: true },
                React.createElement(Input, { id: "maxDuration", name: "maxDuration", value: query.maxDuration || '', placeholder: durationPlaceholder, onChange: (v) => onChange(Object.assign(Object.assign({}, query), { maxDuration: v.currentTarget.value })) }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Limit", labelWidth: 14, grow: true, tooltip: "Maximum number of returned results" },
                React.createElement(Input, { id: "limit", name: "limit", value: query.limit || '', type: "number", onChange: (v) => onChange(Object.assign(Object.assign({}, query), { limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined })) })))));
}
export default SearchForm;
//# sourceMappingURL=SearchForm.js.map