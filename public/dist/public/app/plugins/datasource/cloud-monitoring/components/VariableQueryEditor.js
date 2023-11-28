import { __awaiter, __rest } from "tslib";
import React, { PureComponent } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { extractServicesFromMetricDescriptors, getLabelKeys, getMetricTypes } from '../functions';
import { MetricFindQueryTypes } from '../types/query';
import { VariableQueryField } from './';
export class CloudMonitoringVariableQueryEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.queryTypes = [
            { value: MetricFindQueryTypes.Projects, label: 'Projects' },
            { value: MetricFindQueryTypes.Services, label: 'Services' },
            { value: MetricFindQueryTypes.MetricTypes, label: 'Metric Types' },
            { value: MetricFindQueryTypes.LabelKeys, label: 'Label Keys' },
            { value: MetricFindQueryTypes.LabelValues, label: 'Label Values' },
            { value: MetricFindQueryTypes.ResourceTypes, label: 'Resource Types' },
            { value: MetricFindQueryTypes.Aggregations, label: 'Aggregations' },
            { value: MetricFindQueryTypes.Aligners, label: 'Aligners' },
            { value: MetricFindQueryTypes.AlignmentPeriods, label: 'Alignment Periods' },
            { value: MetricFindQueryTypes.Selectors, label: 'Selectors' },
            { value: MetricFindQueryTypes.SLOServices, label: 'SLO Services' },
            { value: MetricFindQueryTypes.SLO, label: 'Service Level Objectives (SLO)' },
        ];
        this.defaults = {
            selectedQueryType: this.queryTypes[0].value,
            metricDescriptors: [],
            selectedService: '',
            selectedMetricType: '',
            labels: [],
            labelKey: '',
            metricTypes: [],
            services: [],
            sloServices: [],
            selectedSLOService: '',
            projects: [],
            projectName: '',
            loading: true,
        };
        this.onPropsChange = () => {
            const _a = this.state, { metricDescriptors, labels, metricTypes, services } = _a, queryModel = __rest(_a, ["metricDescriptors", "labels", "metricTypes", "services"]);
            this.props.onChange(Object.assign(Object.assign({}, queryModel), { refId: 'CloudMonitoringVariableQueryEditor-VariableQuery' }));
        };
        this.state = Object.assign(this.defaults, this.props.query);
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.props.datasource.ensureGCEDefaultProject();
            const projectName = this.props.query.projectName || this.props.datasource.getDefaultProject();
            const projects = (yield this.props.datasource.getProjects());
            const metricDescriptors = yield this.props.datasource.getMetricTypes(this.props.query.projectName || this.props.datasource.getDefaultProject());
            const services = extractServicesFromMetricDescriptors(metricDescriptors).map((m) => ({
                value: m.service,
                label: m.serviceShortName,
            }));
            let selectedService = '';
            if (services.some((s) => s.value === getTemplateSrv().replace(this.state.selectedService))) {
                selectedService = this.state.selectedService;
            }
            else if (services && services.length > 0) {
                selectedService = services[0].value;
            }
            const { metricTypes, selectedMetricType } = getMetricTypes(metricDescriptors, this.state.selectedMetricType, getTemplateSrv().replace(this.state.selectedMetricType), getTemplateSrv().replace(selectedService));
            const sloServices = yield this.props.datasource.getSLOServices(projectName);
            const state = Object.assign(Object.assign({ services,
                selectedService,
                metricTypes,
                selectedMetricType,
                metricDescriptors,
                projects }, (yield this.getLabels(selectedMetricType, projectName))), { sloServices, loading: false, projectName });
            this.setState(state, () => this.onPropsChange());
        });
    }
    onQueryTypeChange(queryType) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = Object.assign({ selectedQueryType: queryType }, (yield this.getLabels(this.state.selectedMetricType, this.state.projectName, queryType)));
            this.setState(state);
        });
    }
    onProjectChange(projectName) {
        return __awaiter(this, void 0, void 0, function* () {
            const metricDescriptors = yield this.props.datasource.getMetricTypes(projectName);
            const labels = yield this.getLabels(this.state.selectedMetricType, projectName);
            const { metricTypes, selectedMetricType } = getMetricTypes(metricDescriptors, this.state.selectedMetricType, getTemplateSrv().replace(this.state.selectedMetricType), getTemplateSrv().replace(this.state.selectedService));
            const sloServices = yield this.props.datasource.getSLOServices(projectName);
            this.setState(Object.assign(Object.assign({}, labels), { metricTypes,
                selectedMetricType,
                metricDescriptors,
                projectName,
                sloServices }), () => this.onPropsChange());
        });
    }
    onServiceChange(service) {
        return __awaiter(this, void 0, void 0, function* () {
            const { metricTypes, selectedMetricType } = getMetricTypes(this.state.metricDescriptors, this.state.selectedMetricType, getTemplateSrv().replace(this.state.selectedMetricType), getTemplateSrv().replace(service));
            const state = Object.assign({ selectedService: service, metricTypes,
                selectedMetricType }, (yield this.getLabels(selectedMetricType, this.state.projectName)));
            this.setState(state, () => this.onPropsChange());
        });
    }
    onMetricTypeChange(metricType) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = Object.assign({ selectedMetricType: metricType }, (yield this.getLabels(metricType, this.state.projectName)));
            this.setState(state, () => this.onPropsChange());
        });
    }
    onLabelKeyChange(labelKey) {
        this.setState({ labelKey }, () => this.onPropsChange());
    }
    componentDidUpdate(prevProps, prevState) {
        const selecQueryTypeChanged = prevState.selectedQueryType !== this.state.selectedQueryType;
        const selectSLOServiceChanged = this.state.selectedSLOService !== prevState.selectedSLOService;
        if (selecQueryTypeChanged || selectSLOServiceChanged) {
            this.onPropsChange();
        }
    }
    getLabels(selectedMetricType, projectName, selectedQueryType = this.state.selectedQueryType) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = { labels: this.state.labels, labelKey: this.state.labelKey };
            if (selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues) {
                const labels = yield getLabelKeys(this.props.datasource, selectedMetricType, projectName);
                const labelKey = labels.some((l) => l === getTemplateSrv().replace(this.state.labelKey))
                    ? this.state.labelKey
                    : labels[0];
                result = { labels, labelKey };
            }
            return result;
        });
    }
    renderQueryTypeSwitch(queryType) {
        const variableOptionGroup = {
            label: 'Template Variables',
            expanded: false,
            options: getTemplateSrv()
                .getVariables()
                .map((v) => ({
                value: `$${v.name}`,
                label: `$${v.name}`,
            })),
        };
        switch (queryType) {
            case MetricFindQueryTypes.MetricTypes:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: [variableOptionGroup, ...this.state.projects], onChange: (value) => this.onProjectChange(value), label: "Project" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedService, options: [variableOptionGroup, ...this.state.services], onChange: (value) => this.onServiceChange(value), label: "Service" })));
            case MetricFindQueryTypes.LabelKeys:
            case MetricFindQueryTypes.LabelValues:
            case MetricFindQueryTypes.ResourceTypes:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: [variableOptionGroup, ...this.state.projects], onChange: (value) => this.onProjectChange(value), label: "Project" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedService, options: [variableOptionGroup, ...this.state.services], onChange: (value) => this.onServiceChange(value), label: "Service" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedMetricType, options: [
                            variableOptionGroup,
                            ...this.state.metricTypes.map(({ value, name }) => ({ value, label: name })),
                        ], onChange: (value) => this.onMetricTypeChange(value), label: "Metric Type" }),
                    queryType === MetricFindQueryTypes.LabelValues && (React.createElement(VariableQueryField, { value: this.state.labelKey, options: [variableOptionGroup, ...this.state.labels.map((l) => ({ value: l, label: l }))], onChange: (value) => this.onLabelKeyChange(value), label: "Label Key" }))));
            case MetricFindQueryTypes.Aligners:
            case MetricFindQueryTypes.Aggregations:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { value: this.state.selectedService, options: [variableOptionGroup, ...this.state.services], onChange: (value) => this.onServiceChange(value), label: "Service" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedMetricType, options: [
                            variableOptionGroup,
                            ...this.state.metricTypes.map(({ value, name }) => ({ value, label: name })),
                        ], onChange: (value) => this.onMetricTypeChange(value), label: "Metric Type" })));
            case MetricFindQueryTypes.SLOServices:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: [variableOptionGroup, ...this.state.projects], onChange: (value) => this.onProjectChange(value), label: "Project" })));
            case MetricFindQueryTypes.SLO:
                return (React.createElement(React.Fragment, null,
                    React.createElement(VariableQueryField, { allowCustomValue: true, value: this.state.projectName, options: [variableOptionGroup, ...this.state.projects], onChange: (value) => this.onProjectChange(value), label: "Project" }),
                    React.createElement(VariableQueryField, { value: this.state.selectedSLOService, options: [variableOptionGroup, ...this.state.sloServices], onChange: (value) => {
                            this.setState(Object.assign(Object.assign({}, this.state), { selectedSLOService: value }));
                        }, label: "SLO Service" })));
            default:
                return '';
        }
    }
    render() {
        if (this.state.loading) {
            return (React.createElement(VariableQueryField, { value: 'loading', options: [{ value: 'loading', label: 'Loading...' }], onChange: (value) => null, label: "Query Type" }));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(VariableQueryField, { value: this.state.selectedQueryType, options: this.queryTypes, onChange: (value) => this.onQueryTypeChange(value), label: "Query Type" }),
            this.renderQueryTypeSwitch(this.state.selectedQueryType)));
    }
}
//# sourceMappingURL=VariableQueryEditor.js.map