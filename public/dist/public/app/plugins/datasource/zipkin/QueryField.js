import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { fromPairs } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncFn, useMount, useMountedState } from 'react-use';
import { ButtonCascader, FileDropzone, InlineField, InlineFieldRow, RadioButtonGroup, useTheme2, QueryField, useStyles2, Modal, HorizontalGroup, Button, } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { apiPrefix } from './constants';
const getStyles = (theme) => {
    return {
        tracesCascader: css({
            label: 'tracesCascader',
            marginRight: theme.spacing(1),
        }),
    };
};
export const ZipkinQueryField = ({ query, onChange, onRunQuery, datasource }) => {
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const serviceOptions = useServices(datasource);
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const { onLoadOptions, allOptions } = useLoadOptions(datasource);
    const onSelectTrace = useCallback((values, selectedOptions) => {
        if (selectedOptions.length === 3) {
            const traceID = selectedOptions[2].value;
            onChange(Object.assign(Object.assign({}, query), { query: traceID }));
            onRunQuery();
        }
    }, [onChange, onRunQuery, query]);
    useEffect(() => {
        if (!query.queryType) {
            onChange(Object.assign(Object.assign({}, query), { queryType: 'traceID' }));
        }
    }, [query, onChange]);
    const onChangeQuery = (value) => {
        const nextQuery = Object.assign(Object.assign({}, query), { query: value });
        onChange(nextQuery);
    };
    let cascaderOptions = useMapToCascaderOptions(serviceOptions, allOptions);
    return (React.createElement(React.Fragment, null,
        React.createElement(Modal, { title: 'Upload trace', isOpen: uploadModalOpen, onDismiss: () => setUploadModalOpen(false) },
            React.createElement("div", { className: css({ padding: theme.spacing(2) }) },
                React.createElement(FileDropzone, { options: { multiple: false }, onLoad: (result) => {
                        datasource.uploadedJson = result;
                        onChange(Object.assign(Object.assign({}, query), { queryType: 'upload' }));
                        setUploadModalOpen(false);
                        onRunQuery();
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query type", grow: true },
                React.createElement(HorizontalGroup, { spacing: 'sm', align: 'center', justify: 'space-between' },
                    React.createElement(RadioButtonGroup, { options: [{ value: 'traceID', label: 'TraceID' }], value: query.queryType || 'traceID', onChange: (v) => onChange(Object.assign(Object.assign({}, query), { queryType: v })), size: "md" }),
                    React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => {
                            setUploadModalOpen(true);
                        } }, "Import trace")))),
        query.queryType === 'traceID' && (React.createElement(InlineFieldRow, null,
            React.createElement(ButtonCascader, { options: cascaderOptions, onChange: onSelectTrace, loadData: onLoadOptions, variant: "secondary", buttonProps: { className: styles.tracesCascader } }, "Traces"),
            React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1 min-width-15" },
                React.createElement(QueryField, { query: query.query, onChange: onChangeQuery, onRunQuery: onRunQuery, placeholder: 'Insert Trace ID (run with Shift+Enter)', portalOrigin: "zipkin" }))))));
};
// Exported for tests
export function useServices(datasource) {
    const url = `${apiPrefix}/services`;
    const [servicesOptions, fetch] = useAsyncFn(() => __awaiter(this, void 0, void 0, function* () {
        try {
            const services = yield datasource.metadataRequest(url);
            if (services) {
                return services.sort().map((service) => ({
                    label: service,
                    value: service,
                    isLeaf: false,
                }));
            }
            return [];
        }
        catch (error) {
            const errorToShow = error instanceof Error ? error : 'An unknown error occurred';
            dispatch(notifyApp(createErrorNotification('Failed to load services from Zipkin', errorToShow)));
            throw error;
        }
    }), [datasource]);
    useMount(() => {
        // We should probably call this periodically to get new services after mount.
        fetch();
    });
    return servicesOptions;
}
// Exported for tests
export function useLoadOptions(datasource) {
    const isMounted = useMountedState();
    const [allOptions, setAllOptions] = useState({});
    const [, fetchSpans] = useAsyncFn(function findSpans(service) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${apiPrefix}/spans`;
            try {
                // The response of this should have been full ZipkinSpan objects based on API docs but is just list
                // of span names.
                // TODO: check if this is some issue of version used or something else
                const response = yield datasource.metadataRequest(url, { serviceName: service });
                if (isMounted()) {
                    setAllOptions((state) => {
                        const spanOptions = fromPairs(response.map((span) => [span, undefined]));
                        return Object.assign(Object.assign({}, state), { [service]: spanOptions });
                    });
                }
            }
            catch (error) {
                const errorToShow = error instanceof Error ? error : 'An unknown error occurred';
                dispatch(notifyApp(createErrorNotification('Failed to load spans from Zipkin', errorToShow)));
                throw error;
            }
        });
    }, [datasource, allOptions]);
    const [, fetchTraces] = useAsyncFn(function findTraces(serviceName, spanName) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${apiPrefix}/traces`;
            const search = {
                serviceName,
                spanName,
                // See other params and default here https://zipkin.io/zipkin-api/#/default/get_traces
            };
            try {
                // This should return just root traces as there isn't any nesting
                const traces = yield datasource.metadataRequest(url, search);
                if (isMounted()) {
                    const newTraces = traces.length
                        ? fromPairs(traces.map((trace) => {
                            const rootSpan = trace.find((span) => !span.parentId);
                            return [`${rootSpan.name} [${Math.floor(rootSpan.duration / 1000)} ms]`, rootSpan.traceId];
                        }))
                        : noTracesOptions;
                    setAllOptions((state) => {
                        const spans = state[serviceName];
                        return Object.assign(Object.assign({}, state), { [serviceName]: Object.assign(Object.assign({}, spans), { [spanName]: newTraces }) });
                    });
                }
            }
            catch (error) {
                const errorToShow = error instanceof Error ? error : 'An unknown error occurred';
                dispatch(notifyApp(createErrorNotification('Failed to load spans from Zipkin', errorToShow)));
                throw error;
            }
        });
    }, [datasource]);
    const onLoadOptions = useCallback((selectedOptions) => {
        const service = selectedOptions[0].value;
        if (selectedOptions.length === 1) {
            fetchSpans(service);
        }
        else if (selectedOptions.length === 2) {
            const spanName = selectedOptions[1].value;
            fetchTraces(service, spanName);
        }
    }, [fetchSpans, fetchTraces]);
    return {
        onLoadOptions,
        allOptions,
    };
}
function useMapToCascaderOptions(services, allOptions) {
    return useMemo(() => {
        let cascaderOptions = [];
        if (services.value && services.value.length) {
            cascaderOptions = services.value.map((services) => {
                return Object.assign(Object.assign({}, services), { children: allOptions[services.value] &&
                        Object.keys(allOptions[services.value]).map((spanName) => {
                            return {
                                label: spanName,
                                value: spanName,
                                isLeaf: false,
                                children: allOptions[services.value][spanName] &&
                                    Object.keys(allOptions[services.value][spanName]).map((traceName) => {
                                        return {
                                            label: traceName,
                                            value: allOptions[services.value][spanName][traceName],
                                        };
                                    }),
                            };
                        }) });
            });
        }
        else if (services.value && !services.value.length) {
            cascaderOptions = noTracesFoundOptions;
        }
        return cascaderOptions;
    }, [services, allOptions]);
}
const NO_TRACES_KEY = '__NO_TRACES__';
const noTracesFoundOptions = [
    {
        label: 'No traces found',
        value: 'no_traces',
        isLeaf: true,
        // Cannot be disabled because then cascader shows 'loading' for some reason.
        // disabled: true,
    },
];
const noTracesOptions = {
    '[No traces in time range]': NO_TRACES_KEY,
};
//# sourceMappingURL=QueryField.js.map