// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { SpanStatusCode } from '@opentelemetry/api';
import { uniq } from 'lodash';
import React, { useState, useEffect, memo, useCallback } from 'react';
import { toOption } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { Collapse, HorizontalGroup, Icon, InlineField, InlineFieldRow, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { IntervalInput } from 'app/core/components/IntervalInput/IntervalInput';
import { defaultFilters, randomId } from '../../../useSearch';
import { KIND, LIBRARY_NAME, LIBRARY_VERSION, STATUS, STATUS_MESSAGE, TRACE_STATE, ID } from '../../constants/span';
import NextPrevResult from '../SearchBar/NextPrevResult';
import TracePageSearchBar from '../SearchBar/TracePageSearchBar';
export const SpanFilters = memo((props) => {
    const { trace, search, setSearch, showSpanFilters, setShowSpanFilters, showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly, setFocusedSpanIdForSearch, spanFilterMatches, datasourceType, } = props;
    const styles = Object.assign({}, useStyles2(getStyles));
    const [serviceNames, setServiceNames] = useState();
    const [spanNames, setSpanNames] = useState();
    const [tagKeys, setTagKeys] = useState();
    const [tagValues, setTagValues] = useState({});
    const [focusedSpanIndexForSearch, setFocusedSpanIndexForSearch] = useState(-1);
    const durationRegex = /^\d+(?:\.\d)?\d*(?:ns|us|µs|ms|s|m|h)$/;
    const clear = useCallback(() => {
        setServiceNames(undefined);
        setSpanNames(undefined);
        setTagKeys(undefined);
        setTagValues({});
        setSearch(defaultFilters);
        setShowSpanFilterMatchesOnly(false);
    }, [setSearch, setShowSpanFilterMatchesOnly]);
    useEffect(() => {
        clear();
    }, [clear, trace]);
    if (!trace) {
        return null;
    }
    const setSpanFiltersSearch = (spanSearch) => {
        setFocusedSpanIndexForSearch(-1);
        setFocusedSpanIdForSearch('');
        setSearch(spanSearch);
    };
    const getServiceNames = () => {
        if (!serviceNames) {
            const serviceNames = trace.spans.map((span) => {
                return span.process.serviceName;
            });
            setServiceNames(uniq(serviceNames).sort().map(toOption));
        }
    };
    const getSpanNames = () => {
        if (!spanNames) {
            const spanNames = trace.spans.map((span) => {
                return span.operationName;
            });
            setSpanNames(uniq(spanNames).sort().map(toOption));
        }
    };
    const getTagKeys = () => {
        if (!tagKeys) {
            let keys = [];
            let logKeys = [];
            trace.spans.forEach((span) => {
                span.tags.forEach((tag) => {
                    keys.push(tag.key);
                });
                span.process.tags.forEach((tag) => {
                    keys.push(tag.key);
                });
                if (span.logs !== null) {
                    span.logs.forEach((log) => {
                        log.fields.forEach((field) => {
                            logKeys.push(field.key);
                        });
                    });
                }
                if (span.kind) {
                    keys.push(KIND);
                }
                if (span.statusCode !== undefined) {
                    keys.push(STATUS);
                }
                if (span.statusMessage) {
                    keys.push(STATUS_MESSAGE);
                }
                if (span.instrumentationLibraryName) {
                    keys.push(LIBRARY_NAME);
                }
                if (span.instrumentationLibraryVersion) {
                    keys.push(LIBRARY_VERSION);
                }
                if (span.traceState) {
                    keys.push(TRACE_STATE);
                }
                keys.push(ID);
            });
            keys = uniq(keys).sort();
            logKeys = uniq(logKeys).sort();
            setTagKeys([...keys, ...logKeys].map(toOption));
        }
    };
    const getTagValues = (key) => __awaiter(void 0, void 0, void 0, function* () {
        const values = [];
        trace.spans.forEach((span) => {
            var _a, _b;
            const tagValue = (_a = span.tags.find((t) => t.key === key)) === null || _a === void 0 ? void 0 : _a.value;
            if (tagValue) {
                values.push(tagValue.toString());
            }
            const processTagValue = (_b = span.process.tags.find((t) => t.key === key)) === null || _b === void 0 ? void 0 : _b.value;
            if (processTagValue) {
                values.push(processTagValue.toString());
            }
            if (span.logs !== null) {
                span.logs.forEach((log) => {
                    var _a;
                    const logsTagValue = (_a = log.fields.find((t) => t.key === key)) === null || _a === void 0 ? void 0 : _a.value;
                    if (logsTagValue) {
                        values.push(logsTagValue.toString());
                    }
                });
            }
            switch (key) {
                case KIND:
                    if (span.kind) {
                        values.push(span.kind);
                    }
                    break;
                case STATUS:
                    if (span.statusCode !== undefined) {
                        values.push(SpanStatusCode[span.statusCode].toLowerCase());
                    }
                    break;
                case STATUS_MESSAGE:
                    if (span.statusMessage) {
                        values.push(span.statusMessage);
                    }
                    break;
                case LIBRARY_NAME:
                    if (span.instrumentationLibraryName) {
                        values.push(span.instrumentationLibraryName);
                    }
                    break;
                case LIBRARY_VERSION:
                    if (span.instrumentationLibraryVersion) {
                        values.push(span.instrumentationLibraryVersion);
                    }
                    break;
                case TRACE_STATE:
                    if (span.traceState) {
                        values.push(span.traceState);
                    }
                    break;
                case ID:
                    values.push(span.spanID);
                    break;
                default:
                    break;
            }
        });
        return uniq(values).sort().map(toOption);
    });
    const onTagChange = (tag, v) => {
        var _a;
        setSearch(Object.assign(Object.assign({}, search), { tags: (_a = search.tags) === null || _a === void 0 ? void 0 : _a.map((x) => {
                return x.id === tag.id ? Object.assign(Object.assign({}, x), { key: (v === null || v === void 0 ? void 0 : v.value) || '', value: undefined }) : x;
            }) }));
        const loadTagValues = () => __awaiter(void 0, void 0, void 0, function* () {
            if (v === null || v === void 0 ? void 0 : v.value) {
                setTagValues(Object.assign(Object.assign({}, tagValues), { [tag.id]: yield getTagValues(v.value) }));
            }
            else {
                // removed value
                const updatedValues = Object.assign({}, tagValues);
                if (updatedValues[tag.id]) {
                    delete updatedValues[tag.id];
                }
                setTagValues(updatedValues);
            }
        });
        loadTagValues();
    };
    const addTag = () => {
        const tag = {
            id: randomId(),
            operator: '=',
        };
        setSearch(Object.assign(Object.assign({}, search), { tags: [...search.tags, tag] }));
    };
    const removeTag = (id) => {
        let tags = search.tags.filter((tag) => {
            return tag.id !== id;
        });
        if (tags.length === 0) {
            tags = [
                {
                    id: randomId(),
                    operator: '=',
                },
            ];
        }
        setSearch(Object.assign(Object.assign({}, search), { tags: tags }));
    };
    const collapseLabel = (React.createElement(React.Fragment, null,
        React.createElement(Tooltip, { content: "Filter your spans below. You can continue to apply filters until you have narrowed down your resulting spans to the select few you are most interested in.", placement: "right" },
            React.createElement("span", { className: styles.collapseLabel },
                "Span Filters",
                React.createElement(Icon, { size: "md", name: "info-circle" }))),
        !showSpanFilters && (React.createElement("div", { className: styles.nextPrevResult },
            React.createElement(NextPrevResult, { trace: trace, spanFilterMatches: spanFilterMatches, setFocusedSpanIdForSearch: setFocusedSpanIdForSearch, focusedSpanIndexForSearch: focusedSpanIndexForSearch, setFocusedSpanIndexForSearch: setFocusedSpanIndexForSearch, datasourceType: datasourceType, showSpanFilters: showSpanFilters })))));
    return (React.createElement("div", { className: styles.container },
        React.createElement(Collapse, { label: collapseLabel, collapsible: true, isOpen: showSpanFilters, onToggle: setShowSpanFilters },
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Service Name", labelWidth: 16 },
                    React.createElement(HorizontalGroup, { spacing: 'xs' },
                        React.createElement(Select, { "aria-label": "Select service name operator", onChange: (v) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { serviceNameOperator: v.value })), options: [toOption('='), toOption('!=')], value: search.serviceNameOperator }),
                        React.createElement(Select, { "aria-label": "Select service name", isClearable: true, onChange: (v) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { serviceName: (v === null || v === void 0 ? void 0 : v.value) || '' })), onOpenMenu: getServiceNames, options: serviceNames, placeholder: "All service names", value: search.serviceName || null })))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Span Name", labelWidth: 16 },
                    React.createElement(HorizontalGroup, { spacing: 'xs' },
                        React.createElement(Select, { "aria-label": "Select span name operator", onChange: (v) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { spanNameOperator: v.value })), options: [toOption('='), toOption('!=')], value: search.spanNameOperator }),
                        React.createElement(Select, { "aria-label": "Select span name", isClearable: true, onChange: (v) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { spanName: (v === null || v === void 0 ? void 0 : v.value) || '' })), onOpenMenu: getSpanNames, options: spanNames, placeholder: "All span names", value: search.spanName || null })))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Duration", labelWidth: 16, tooltip: "Filter by duration. Accepted units are ns, us, ms, s, m, h" },
                    React.createElement(HorizontalGroup, { spacing: "xs", align: "flex-start" },
                        React.createElement(Select, { "aria-label": "Select min span operator", onChange: (v) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { fromOperator: v.value })), options: [toOption('>'), toOption('>=')], value: search.fromOperator }),
                        React.createElement("div", { className: styles.intervalInput },
                            React.createElement(IntervalInput, { ariaLabel: "Select min span duration", onChange: (val) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { from: val })), isInvalidError: "Invalid duration", placeholder: "e.g. 100ms, 1.2s", width: 18, value: search.from || '', validationRegex: durationRegex })),
                        React.createElement(Select, { "aria-label": "Select max span operator", onChange: (v) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { toOperator: v.value })), options: [toOption('<'), toOption('<=')], value: search.toOperator }),
                        React.createElement(IntervalInput, { ariaLabel: "Select max span duration", onChange: (val) => setSpanFiltersSearch(Object.assign(Object.assign({}, search), { to: val })), isInvalidError: "Invalid duration", placeholder: "e.g. 100ms, 1.2s", width: 18, value: search.to || '', validationRegex: durationRegex })))),
            React.createElement(InlineFieldRow, { className: styles.tagsRow },
                React.createElement(InlineField, { label: "Tags", labelWidth: 16, tooltip: "Filter by tags, process tags or log fields in your spans." },
                    React.createElement("div", null, search.tags.map((tag, i) => {
                        var _a;
                        return (React.createElement("div", { key: i },
                            React.createElement(HorizontalGroup, { spacing: 'xs', width: 'auto' },
                                React.createElement(Select, { "aria-label": "Select tag key", isClearable: true, key: tag.key, onChange: (v) => onTagChange(tag, v), onOpenMenu: getTagKeys, options: tagKeys, placeholder: "Select tag", value: tag.key || null }),
                                React.createElement(Select, { "aria-label": "Select tag operator", onChange: (v) => {
                                        var _a;
                                        setSpanFiltersSearch(Object.assign(Object.assign({}, search), { tags: (_a = search.tags) === null || _a === void 0 ? void 0 : _a.map((x) => {
                                                return x.id === tag.id ? Object.assign(Object.assign({}, x), { operator: v.value }) : x;
                                            }) }));
                                    }, options: [toOption('='), toOption('!=')], value: tag.operator }),
                                React.createElement("span", { className: styles.tagValues },
                                    React.createElement(Select, { "aria-label": "Select tag value", isClearable: true, key: tag.value, onChange: (v) => {
                                            var _a;
                                            setSpanFiltersSearch(Object.assign(Object.assign({}, search), { tags: (_a = search.tags) === null || _a === void 0 ? void 0 : _a.map((x) => {
                                                    return x.id === tag.id ? Object.assign(Object.assign({}, x), { value: (v === null || v === void 0 ? void 0 : v.value) || '' }) : x;
                                                }) }));
                                        }, options: tagValues[tag.id] ? tagValues[tag.id] : [], placeholder: "Select value", value: tag.value })),
                                React.createElement(AccessoryButton, { "aria-label": "Remove tag", variant: "secondary", icon: "times", onClick: () => removeTag(tag.id), title: "Remove tag" }),
                                React.createElement("span", { className: styles.addTag }, ((_a = search === null || search === void 0 ? void 0 : search.tags) === null || _a === void 0 ? void 0 : _a.length) && i === search.tags.length - 1 && (React.createElement(AccessoryButton, { "aria-label": "Add tag", variant: "secondary", icon: "plus", onClick: addTag, title: "Add tag" }))))));
                    })))),
            React.createElement(TracePageSearchBar, { trace: trace, search: search, spanFilterMatches: spanFilterMatches, showSpanFilterMatchesOnly: showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly: setShowSpanFilterMatchesOnly, setFocusedSpanIdForSearch: setFocusedSpanIdForSearch, focusedSpanIndexForSearch: focusedSpanIndexForSearch, setFocusedSpanIndexForSearch: setFocusedSpanIndexForSearch, datasourceType: datasourceType, clear: clear, showSpanFilters: showSpanFilters }))));
});
SpanFilters.displayName = 'SpanFilters';
const getStyles = (theme) => {
    return {
        container: css `
      margin: 0.5em 0 -${theme.spacing(1)} 0;
      z-index: 5;

      & > div {
        border-left: none;
        border-right: none;
      }
    `,
        collapseLabel: css `
      svg {
        color: #aaa;
        margin: -2px 0 0 10px;
      }
    `,
        addTag: css `
      margin: 0 0 0 10px;
    `,
        intervalInput: css `
      margin: 0 -4px 0 0;
    `,
        tagsRow: css `
      margin: -4px 0 0 0;
    `,
        tagValues: css `
      max-width: 200px;
    `,
        nextPrevResult: css `
      flex: 1;
      align-items: center;
      display: flex;
      justify-content: flex-end;
      margin-right: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=SpanFilters.js.map