import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, FileDropzone, HorizontalGroup, InlineField, InlineFieldRow, Modal, RadioButtonGroup, withTheme2, } from '@grafana/ui';
import { LokiSearch } from './LokiSearch';
import NativeSearch from './NativeSearch/NativeSearch';
import TraceQLSearch from './SearchTraceQLEditor/TraceQLSearch';
import { ServiceGraphSection } from './ServiceGraphSection';
import { QueryEditor } from './traceql/QueryEditor';
// This needs to default to traceql for data sources like Splunk, where clicking on a
// data link should open the traceql tab and run a search based on the configured query.
const DEFAULT_QUERY_TYPE = 'traceql';
class TempoQueryFieldComponent extends React.PureComponent {
    constructor(props) {
        super(props);
        this.onChangeLinkedQuery = (value) => {
            const { query, onChange } = this.props;
            onChange(Object.assign(Object.assign({}, query), { linkedQuery: Object.assign(Object.assign({}, value), { refId: 'linked' }) }));
        };
        this.onRunLinkedQuery = () => {
            this.props.onRunQuery();
        };
        this.onClearResults = () => {
            // Run clear query to clear results
            const { onChange, query, onRunQuery } = this.props;
            onChange(Object.assign(Object.assign({}, query), { queryType: 'clear' }));
            onRunQuery();
        };
        this.state = {
            uploadModalOpen: false,
        };
    }
    // Set the default query type when the component mounts.
    // Also do this if queryType is 'clear' (which is the case when the user changes the query type)
    // otherwise if the user changes the query type and refreshes the page, no query type will be selected
    // which is inconsistent with how the UI was originally when they selected the Tempo data source.
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.props.query.queryType || this.props.query.queryType === 'clear') {
                this.props.onChange(Object.assign(Object.assign({}, this.props.query), { queryType: DEFAULT_QUERY_TYPE }));
            }
        });
    }
    render() {
        var _a, _b;
        const { query, onChange, datasource, app } = this.props;
        const logsDatasourceUid = datasource.getLokiSearchDS();
        const graphDatasourceUid = (_a = datasource.serviceMap) === null || _a === void 0 ? void 0 : _a.datasourceUid;
        let queryTypeOptions = [
            { value: 'traceqlSearch', label: 'Search' },
            { value: 'traceql', label: 'TraceQL' },
            { value: 'serviceMap', label: 'Service Graph' },
        ];
        if (logsDatasourceUid) {
            if ((_b = datasource === null || datasource === void 0 ? void 0 : datasource.search) === null || _b === void 0 ? void 0 : _b.hide) {
                // Place at beginning as Search if no native search
                queryTypeOptions.unshift({ value: 'search', label: 'Search' });
            }
            else {
                // Place at end as Loki Search if native search is enabled
                queryTypeOptions.push({ value: 'search', label: 'Loki Search' });
            }
        }
        // Show the deprecated search option if any of the deprecated search fields are set
        if (query.spanName ||
            query.serviceName ||
            query.search ||
            query.maxDuration ||
            query.minDuration ||
            query.queryType === 'nativeSearch') {
            queryTypeOptions.unshift({ value: 'nativeSearch', label: '[Deprecated] Search' });
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(Modal, { title: 'Upload trace', isOpen: this.state.uploadModalOpen, onDismiss: () => this.setState({ uploadModalOpen: false }) },
                React.createElement("div", { className: css({ padding: this.props.theme.spacing(2) }) },
                    React.createElement(FileDropzone, { options: { multiple: false }, onLoad: (result) => {
                            this.props.datasource.uploadedJson = result;
                            onChange(Object.assign(Object.assign({}, query), { queryType: 'upload' }));
                            this.setState({ uploadModalOpen: false });
                            this.props.onRunQuery();
                        } }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Query type", grow: true },
                    React.createElement(HorizontalGroup, { spacing: 'sm', align: 'center', justify: 'space-between' },
                        React.createElement(RadioButtonGroup, { options: queryTypeOptions, value: query.queryType, onChange: (v) => {
                                var _a;
                                reportInteraction('grafana_traces_query_type_changed', {
                                    datasourceType: 'tempo',
                                    app: app !== null && app !== void 0 ? app : '',
                                    grafana_version: config.buildInfo.version,
                                    newQueryType: v,
                                    previousQueryType: (_a = query.queryType) !== null && _a !== void 0 ? _a : '',
                                });
                                this.onClearResults();
                                onChange(Object.assign(Object.assign({}, query), { queryType: v }));
                            }, size: "md" }),
                        React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => {
                                this.setState({ uploadModalOpen: true });
                            } }, "Import trace")))),
            query.queryType === 'search' && (React.createElement(LokiSearch, { logsDatasourceUid: logsDatasourceUid, query: query, onRunQuery: this.onRunLinkedQuery, onChange: this.onChangeLinkedQuery })),
            query.queryType === 'nativeSearch' && (React.createElement(NativeSearch, { datasource: this.props.datasource, query: query, onChange: onChange, onBlur: this.props.onBlur, onRunQuery: this.props.onRunQuery })),
            query.queryType === 'traceqlSearch' && (React.createElement(TraceQLSearch, { datasource: this.props.datasource, query: query, onChange: onChange, onBlur: this.props.onBlur })),
            query.queryType === 'serviceMap' && (React.createElement(ServiceGraphSection, { graphDatasourceUid: graphDatasourceUid, query: query, onChange: onChange })),
            query.queryType === 'traceql' && (React.createElement(QueryEditor, { datasource: this.props.datasource, query: query, onRunQuery: this.props.onRunQuery, onChange: onChange }))));
    }
}
export const TempoQueryField = withTheme2(TempoQueryFieldComponent);
//# sourceMappingURL=QueryField.js.map