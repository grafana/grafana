import React, { useCallback } from 'react';
import { Button, Field, InlineField, InlineFieldRow, JSONFormatter, RadioButtonGroup, Select } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
import { defaultApiConfig } from 'app/features/canvas/elements/button';
import { HttpRequestMethod } from '../../panelcfg.gen';
import { ParamsEditor } from './ParamsEditor';
import { callApi, interpolateVariables } from './utils';
const dummyStringSettings = {
    settings: {},
};
const httpMethodOptions = [
    { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
    { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
];
const contentTypeOptions = [
    { label: 'JSON', value: 'application/json' },
    { label: 'Text', value: 'text/plain' },
    { label: 'JavaScript', value: 'application/javascript' },
    { label: 'HTML', value: 'text/html' },
    { label: 'XML', value: 'application/XML' },
    { label: 'x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
];
export function APIEditor({ value, context, onChange }) {
    var _a, _b, _c, _d;
    const LABEL_WIDTH = 13;
    if (!value) {
        value = defaultApiConfig;
    }
    const onEndpointChange = useCallback((endpoint = '') => {
        onChange(Object.assign(Object.assign({}, value), { endpoint }));
    }, [onChange, value]);
    const onDataChange = useCallback((data) => {
        onChange(Object.assign(Object.assign({}, value), { data }));
    }, [onChange, value]);
    const onMethodChange = useCallback((method) => {
        onChange(Object.assign(Object.assign({}, value), { method }));
    }, [onChange, value]);
    const onContentTypeChange = useCallback((contentType) => {
        onChange(Object.assign(Object.assign({}, value), { contentType: contentType === null || contentType === void 0 ? void 0 : contentType.value }));
    }, [onChange, value]);
    const formatCreateLabel = (input) => {
        return input;
    };
    const onQueryParamsChange = useCallback((queryParams) => {
        onChange(Object.assign(Object.assign({}, value), { queryParams }));
    }, [onChange, value]);
    const onHeaderParamsChange = useCallback((headerParams) => {
        onChange(Object.assign(Object.assign({}, value), { headerParams }));
    }, [onChange, value]);
    const renderJSON = (data) => {
        try {
            const json = JSON.parse(interpolateVariables(data));
            return React.createElement(JSONFormatter, { json: json });
        }
        catch (error) {
            if (error instanceof Error) {
                return `Invalid JSON provided: ${error.message}`;
            }
            else {
                return 'Invalid JSON provided';
            }
        }
    };
    const renderTestAPIButton = (api) => {
        if (api && api.endpoint) {
            return (React.createElement(Button, { onClick: () => callApi(api), title: "Test API" }, "Test API"));
        }
        return;
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Endpoint", labelWidth: LABEL_WIDTH, grow: true },
                React.createElement(StringValueEditor, { context: context, value: value === null || value === void 0 ? void 0 : value.endpoint, onChange: onEndpointChange, item: dummyStringSettings }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Method", labelWidth: LABEL_WIDTH, grow: true },
                React.createElement(RadioButtonGroup, { value: value === null || value === void 0 ? void 0 : value.method, options: httpMethodOptions, onChange: onMethodChange, fullWidth: true }))),
        (value === null || value === void 0 ? void 0 : value.method) === HttpRequestMethod.POST && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Content-Type", labelWidth: LABEL_WIDTH, grow: true },
                React.createElement(Select, { options: contentTypeOptions, allowCustomValue: true, formatCreateLabel: formatCreateLabel, value: value === null || value === void 0 ? void 0 : value.contentType, onChange: onContentTypeChange })))),
        React.createElement("br", null),
        React.createElement(Field, { label: "Query parameters" },
            React.createElement(ParamsEditor, { value: (_a = value === null || value === void 0 ? void 0 : value.queryParams) !== null && _a !== void 0 ? _a : [], onChange: onQueryParamsChange })),
        React.createElement(Field, { label: "Header parameters" },
            React.createElement(ParamsEditor, { value: (_b = value === null || value === void 0 ? void 0 : value.headerParams) !== null && _b !== void 0 ? _b : [], onChange: onHeaderParamsChange })),
        (value === null || value === void 0 ? void 0 : value.method) === HttpRequestMethod.POST && (value === null || value === void 0 ? void 0 : value.contentType) && (React.createElement(Field, { label: "Payload" },
            React.createElement(StringValueEditor, { context: context, value: (_c = value === null || value === void 0 ? void 0 : value.data) !== null && _c !== void 0 ? _c : '{}', onChange: onDataChange, item: Object.assign(Object.assign({}, dummyStringSettings), { settings: { useTextarea: true } }) }))),
        renderTestAPIButton(value),
        React.createElement("br", null),
        (value === null || value === void 0 ? void 0 : value.method) === HttpRequestMethod.POST &&
            (value === null || value === void 0 ? void 0 : value.contentType) === defaultApiConfig.contentType &&
            renderJSON((_d = value === null || value === void 0 ? void 0 : value.data) !== null && _d !== void 0 ? _d : '{}')));
}
//# sourceMappingURL=APIEditor.js.map