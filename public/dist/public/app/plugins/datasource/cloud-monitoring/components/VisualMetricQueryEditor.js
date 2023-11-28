import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { startCase, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { getSelectStyles, Select, AsyncSelect, useStyles2, useTheme2 } from '@grafana/ui';
import { getAlignmentPickerData, getMetricType, setMetricType } from '../functions';
import { PreprocessorType, MetricKind, ValueTypes } from '../types/query';
import { AliasBy } from './AliasBy';
import { Alignment } from './Alignment';
import { GroupBy } from './GroupBy';
import { LabelFilter } from './LabelFilter';
import { defaultTimeSeriesList } from './MetricQueryEditor';
import { Preprocessor } from './Preprocessor';
import { Project } from './Project';
export function Editor({ refId, onChange, datasource, query, variableOptionGroup, customMetaData, aliasBy, onChangeAliasBy, }) {
    const [labels, setLabels] = useState({});
    const [metricDescriptors, setMetricDescriptors] = useState([]);
    const [metricDescriptor, setMetricDescriptor] = useState();
    const [metrics, setMetrics] = useState([]);
    const [services, setServices] = useState([]);
    const [service, setService] = useState('');
    const [timeRange, setTimeRange] = useState(Object.assign({}, datasource.timeSrv.timeRange()));
    const useTime = (time) => {
        if (timeRange !== null &&
            (timeRange.raw.from.toString() !== time.raw.from.toString() ||
                timeRange.raw.to.toString() !== time.raw.to.toString())) {
            setTimeRange(Object.assign({}, time));
        }
    };
    useTime(datasource.timeSrv.timeRange());
    const theme = useTheme2();
    const selectStyles = getSelectStyles(theme);
    const customStyle = useStyles2(getStyles);
    const { projectName, groupBys, crossSeriesReducer } = query;
    const metricType = getMetricType(query);
    const { templateSrv } = datasource;
    const getSelectedMetricDescriptor = useCallback((metricDescriptors, metricType) => {
        return metricDescriptors.find((md) => md.type === templateSrv.replace(metricType));
    }, [templateSrv]);
    useEffect(() => {
        if (projectName && metricType) {
            datasource
                .getLabels(metricType, refId, projectName, { groupBys, crossSeriesReducer }, timeRange)
                .then((labels) => setLabels(labels));
        }
    }, [datasource, groupBys, metricType, projectName, refId, crossSeriesReducer, timeRange]);
    useEffect(() => {
        const loadMetricDescriptors = () => __awaiter(this, void 0, void 0, function* () {
            if (projectName) {
                const metricDescriptors = yield datasource.getMetricTypes(projectName);
                reportInteraction('cloud-monitoring-metric-descriptors-loaded', {
                    count: metricDescriptors.length,
                });
                const services = getServicesList(metricDescriptors);
                setMetricDescriptors(metricDescriptors);
                setServices(services);
            }
        });
        loadMetricDescriptors();
    }, [datasource, projectName, customStyle, selectStyles.optionDescription]);
    useEffect(() => {
        const getMetricsList = (metricDescriptors) => {
            const selectedMetricDescriptor = getSelectedMetricDescriptor(metricDescriptors, metricType);
            if (!selectedMetricDescriptor) {
                return [];
            }
            const metricsByService = metricDescriptors
                .filter((m) => m.service === selectedMetricDescriptor.service)
                .map((m) => ({
                service: m.service,
                value: m.type,
                label: m.displayName,
                component: function optionComponent() {
                    return (React.createElement("div", null,
                        React.createElement("div", { className: customStyle }, m.type),
                        React.createElement("div", { className: selectStyles.optionDescription }, m.description)));
                },
            }));
            return metricsByService;
        };
        const metrics = getMetricsList(metricDescriptors);
        const service = metrics.length > 0 ? metrics[0].service : '';
        const metricDescriptor = getSelectedMetricDescriptor(metricDescriptors, metricType);
        setMetricDescriptor(metricDescriptor);
        setMetrics(metrics);
        setService(service);
    }, [metricDescriptors, getSelectedMetricDescriptor, metricType, customStyle, selectStyles.optionDescription]);
    const onServiceChange = ({ value: service }) => {
        const metrics = metricDescriptors
            .filter((m) => m.service === templateSrv.replace(service))
            .map((m) => ({
            service: m.service,
            value: m.type,
            label: m.displayName,
            description: m.description,
        }));
        // On service change reset all query values except the project name
        query.filters = [];
        if (metrics.length > 0 && !metrics.some((m) => m.value === templateSrv.replace(metricType))) {
            onMetricTypeChange(metrics[0]);
            setService(service);
            setMetrics(metrics);
        }
        else {
            setService(service);
            setMetrics(metrics);
        }
    };
    const getServicesList = (metricDescriptors) => {
        const services = metricDescriptors.map((m) => ({
            value: m.service,
            label: startCase(m.serviceShortName),
        }));
        return services.length > 0 ? uniqBy(services, (s) => s.value) : [];
    };
    const filterMetrics = (filter) => __awaiter(this, void 0, void 0, function* () {
        const metrics = yield datasource.filterMetricsByType(projectName, service);
        const filtered = metrics
            .filter((m) => m.type.includes(filter.toLowerCase()))
            .map((m) => ({
            value: m.type,
            label: m.displayName,
            component: function optionComponent() {
                return (React.createElement("div", null,
                    React.createElement("div", { className: customStyle }, m.type),
                    React.createElement("div", { className: selectStyles.optionDescription }, m.description)));
            },
        }));
        return [
            {
                label: 'Template Variables',
                options: variableOptionGroup.options,
            },
            ...filtered,
        ];
    });
    const debounceFilter = debounce(filterMetrics, 400);
    const onMetricTypeChange = ({ value }) => {
        const metricDescriptor = getSelectedMetricDescriptor(metricDescriptors, value);
        setMetricDescriptor(metricDescriptor);
        const { metricKind, valueType } = metricDescriptor;
        const preprocessor = metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION
            ? PreprocessorType.None
            : PreprocessorType.Rate;
        const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, query.perSeriesAligner, preprocessor);
        // On metric name change reset query to defaults except project name and filters
        Object.assign(query, Object.assign(Object.assign({}, defaultTimeSeriesList(datasource)), { projectName: query.projectName, filters: query.filters }));
        onChange(Object.assign(Object.assign({}, setMetricType(Object.assign(Object.assign({}, query), { perSeriesAligner }), value)), { preprocessor }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRow, null,
            React.createElement(EditorFieldGroup, null,
                React.createElement(Project, { refId: refId, templateVariableOptions: variableOptionGroup.options, projectName: projectName, datasource: datasource, onChange: (projectName) => {
                        onChange(Object.assign(Object.assign({}, query), { projectName }));
                    } }),
                React.createElement(EditorField, { label: "Service", width: "auto" },
                    React.createElement(Select, { width: "auto", onChange: onServiceChange, isLoading: services.length === 0, value: [...services, ...variableOptionGroup.options].find((s) => s.value === service), options: [
                            {
                                label: 'Template Variables',
                                options: variableOptionGroup.options,
                            },
                            ...services,
                        ], placeholder: "Select Services", inputId: `${refId}-service` })),
                React.createElement(EditorField, { label: "Metric name", width: "auto", htmlFor: `${refId}-select-metric` },
                    React.createElement("span", { title: service === '' ? 'Select a service first' : 'Type to search metrics' },
                        React.createElement(AsyncSelect, { width: "auto", onChange: onMetricTypeChange, value: [...metrics, ...variableOptionGroup.options].find((s) => s.value === metricType), loadOptions: debounceFilter, defaultOptions: [
                                {
                                    label: 'Template Variables',
                                    options: variableOptionGroup.options,
                                },
                                ...metrics.slice(0, 100),
                            ], placeholder: "Select Metric", inputId: `${refId}-select-metric`, disabled: service === '' }))))),
        React.createElement(React.Fragment, null,
            React.createElement(LabelFilter, { labels: labels, filters: query.filters, onChange: (filters) => onChange(Object.assign(Object.assign({}, query), { filters })), variableOptionGroup: variableOptionGroup }),
            React.createElement(EditorRow, null,
                React.createElement(Preprocessor, { metricDescriptor: metricDescriptor, query: query, onChange: onChange }),
                React.createElement(GroupBy, { refId: refId, labels: Object.keys(labels), query: query, onChange: onChange, variableOptionGroup: variableOptionGroup, metricDescriptor: metricDescriptor }),
                React.createElement(Alignment, { refId: refId, datasource: datasource, templateVariableOptions: variableOptionGroup.options, query: query, customMetaData: customMetaData, onChange: onChange, metricDescriptor: metricDescriptor, preprocessor: query.preprocessor }),
                React.createElement(AliasBy, { refId: refId, value: aliasBy, onChange: onChangeAliasBy })))));
}
const getStyles = (theme) => css `
  label: grafana-select-option-description;
  font-weight: normal;
  font-style: italic;
  color: ${theme.colors.text.secondary};
`;
export const VisualMetricQueryEditor = React.memo(Editor);
//# sourceMappingURL=VisualMetricQueryEditor.js.map