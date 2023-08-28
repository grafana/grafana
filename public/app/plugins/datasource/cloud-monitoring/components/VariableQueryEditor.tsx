import React, { PureComponent } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import CloudMonitoringDatasource from '../datasource';
import { extractServicesFromMetricDescriptors, getLabelKeys, getMetricTypes } from '../functions';
import { CloudMonitoringQuery, MetricFindQueryTypes } from '../types/query';
import {
  CloudMonitoringOptions,
  CloudMonitoringVariableQuery,
  MetricDescriptor,
  VariableQueryData,
} from '../types/types';

import { VariableQueryField } from './';

export type Props = QueryEditorProps<
  CloudMonitoringDatasource,
  CloudMonitoringQuery,
  CloudMonitoringOptions,
  CloudMonitoringVariableQuery
>;

export class CloudMonitoringVariableQueryEditor extends PureComponent<Props, VariableQueryData> {
  queryTypes: Array<{ value: string; label: string }> = [
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

  defaults: VariableQueryData = {
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

  constructor(props: Props) {
    super(props);
    this.state = Object.assign(this.defaults, this.props.query);
  }

  async componentDidMount() {
    await this.props.datasource.ensureGCEDefaultProject();
    const projectName = this.props.query.projectName || this.props.datasource.getDefaultProject();
    const projects = (await this.props.datasource.getProjects()) as MetricDescriptor[];
    const metricDescriptors = await this.props.datasource.getMetricTypes(
      this.props.query.projectName || this.props.datasource.getDefaultProject()
    );
    const services = extractServicesFromMetricDescriptors(metricDescriptors).map((m: any) => ({
      value: m.service,
      label: m.serviceShortName,
    }));

    let selectedService = '';
    if (services.some((s) => s.value === getTemplateSrv().replace(this.state.selectedService))) {
      selectedService = this.state.selectedService;
    } else if (services && services.length > 0) {
      selectedService = services[0].value;
    }

    const { metricTypes, selectedMetricType } = getMetricTypes(
      metricDescriptors,
      this.state.selectedMetricType,
      getTemplateSrv().replace(this.state.selectedMetricType),
      getTemplateSrv().replace(selectedService)
    );

    const sloServices = await this.props.datasource.getSLOServices(projectName);

    const state: any = {
      services,
      selectedService,
      metricTypes,
      selectedMetricType,
      metricDescriptors,
      projects,
      ...(await this.getLabels(selectedMetricType, projectName)),
      sloServices,
      loading: false,
      projectName,
    };
    this.setState(state, () => this.onPropsChange());
  }

  onPropsChange = () => {
    const { metricDescriptors, labels, metricTypes, services, ...queryModel } = this.state;
    this.props.onChange({ ...queryModel, refId: 'CloudMonitoringVariableQueryEditor-VariableQuery' });
  };

  async onQueryTypeChange(queryType: string) {
    const state: any = {
      selectedQueryType: queryType,
      ...(await this.getLabels(this.state.selectedMetricType, this.state.projectName, queryType)),
    };

    this.setState(state);
  }

  async onProjectChange(projectName: string) {
    const metricDescriptors = await this.props.datasource.getMetricTypes(projectName);
    const labels = await this.getLabels(this.state.selectedMetricType, projectName);
    const { metricTypes, selectedMetricType } = getMetricTypes(
      metricDescriptors,
      this.state.selectedMetricType,
      getTemplateSrv().replace(this.state.selectedMetricType),
      getTemplateSrv().replace(this.state.selectedService)
    );

    const sloServices = await this.props.datasource.getSLOServices(projectName);

    this.setState(
      {
        ...labels,
        metricTypes,
        selectedMetricType,
        metricDescriptors,
        projectName,
        sloServices,
      },
      () => this.onPropsChange()
    );
  }

  async onServiceChange(service: string) {
    const { metricTypes, selectedMetricType } = getMetricTypes(
      this.state.metricDescriptors,
      this.state.selectedMetricType,
      getTemplateSrv().replace(this.state.selectedMetricType),
      getTemplateSrv().replace(service)
    );
    const state: any = {
      selectedService: service,
      metricTypes,
      selectedMetricType,
      ...(await this.getLabels(selectedMetricType, this.state.projectName)),
    };
    this.setState(state, () => this.onPropsChange());
  }

  async onMetricTypeChange(metricType: string) {
    const state: any = {
      selectedMetricType: metricType,
      ...(await this.getLabels(metricType, this.state.projectName)),
    };
    this.setState(state, () => this.onPropsChange());
  }

  onLabelKeyChange(labelKey: string) {
    this.setState({ labelKey }, () => this.onPropsChange());
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<VariableQueryData>) {
    const selecQueryTypeChanged = prevState.selectedQueryType !== this.state.selectedQueryType;
    const selectSLOServiceChanged = this.state.selectedSLOService !== prevState.selectedSLOService;
    if (selecQueryTypeChanged || selectSLOServiceChanged) {
      this.onPropsChange();
    }
  }

  async getLabels(selectedMetricType: string, projectName: string, selectedQueryType = this.state.selectedQueryType) {
    let result = { labels: this.state.labels, labelKey: this.state.labelKey };
    if (selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues) {
      const labels = await getLabelKeys(this.props.datasource, selectedMetricType, projectName);
      const labelKey = labels.some((l) => l === getTemplateSrv().replace(this.state.labelKey))
        ? this.state.labelKey
        : labels[0];
      result = { labels, labelKey };
    }
    return result;
  }

  renderQueryTypeSwitch(queryType: string) {
    const variableOptionGroup = {
      label: 'Template Variables',
      expanded: false,
      options: getTemplateSrv()
        .getVariables()
        .map((v: any) => ({
          value: `$${v.name}`,
          label: `$${v.name}`,
        })),
    };

    switch (queryType) {
      case MetricFindQueryTypes.MetricTypes:
        return (
          <>
            <VariableQueryField
              allowCustomValue={true}
              value={this.state.projectName}
              options={[variableOptionGroup, ...this.state.projects]}
              onChange={(value) => this.onProjectChange(value)}
              label="Project"
            />
            <VariableQueryField
              value={this.state.selectedService}
              options={[variableOptionGroup, ...this.state.services]}
              onChange={(value) => this.onServiceChange(value)}
              label="Service"
            />
          </>
        );
      case MetricFindQueryTypes.LabelKeys:
      case MetricFindQueryTypes.LabelValues:
      case MetricFindQueryTypes.ResourceTypes:
        return (
          <>
            <VariableQueryField
              allowCustomValue={true}
              value={this.state.projectName}
              options={[variableOptionGroup, ...this.state.projects]}
              onChange={(value) => this.onProjectChange(value)}
              label="Project"
            />
            <VariableQueryField
              value={this.state.selectedService}
              options={[variableOptionGroup, ...this.state.services]}
              onChange={(value) => this.onServiceChange(value)}
              label="Service"
            />
            <VariableQueryField
              value={this.state.selectedMetricType}
              options={[
                variableOptionGroup,
                ...this.state.metricTypes.map(({ value, name }) => ({ value, label: name })),
              ]}
              onChange={(value) => this.onMetricTypeChange(value)}
              label="Metric Type"
            />
            {queryType === MetricFindQueryTypes.LabelValues && (
              <VariableQueryField
                value={this.state.labelKey}
                options={[variableOptionGroup, ...this.state.labels.map((l) => ({ value: l, label: l }))]}
                onChange={(value) => this.onLabelKeyChange(value)}
                label="Label Key"
              />
            )}
          </>
        );
      case MetricFindQueryTypes.Aligners:
      case MetricFindQueryTypes.Aggregations:
        return (
          <>
            <VariableQueryField
              value={this.state.selectedService}
              options={[variableOptionGroup, ...this.state.services]}
              onChange={(value) => this.onServiceChange(value)}
              label="Service"
            />
            <VariableQueryField
              value={this.state.selectedMetricType}
              options={[
                variableOptionGroup,
                ...this.state.metricTypes.map(({ value, name }) => ({ value, label: name })),
              ]}
              onChange={(value) => this.onMetricTypeChange(value)}
              label="Metric Type"
            />
          </>
        );
      case MetricFindQueryTypes.SLOServices:
        return (
          <>
            <VariableQueryField
              allowCustomValue={true}
              value={this.state.projectName}
              options={[variableOptionGroup, ...this.state.projects]}
              onChange={(value) => this.onProjectChange(value)}
              label="Project"
            />
          </>
        );

      case MetricFindQueryTypes.SLO:
        return (
          <>
            <VariableQueryField
              allowCustomValue={true}
              value={this.state.projectName}
              options={[variableOptionGroup, ...this.state.projects]}
              onChange={(value) => this.onProjectChange(value)}
              label="Project"
            />
            <VariableQueryField
              value={this.state.selectedSLOService}
              options={[variableOptionGroup, ...this.state.sloServices]}
              onChange={(value) => {
                this.setState({
                  ...this.state,
                  selectedSLOService: value,
                });
              }}
              label="SLO Service"
            />
          </>
        );
      default:
        return '';
    }
  }

  render() {
    if (this.state.loading) {
      return (
        <div className="gf-form max-width-21">
          <span className="gf-form-label width-10 query-keyword">Query Type</span>
          <div className="gf-form-select-wrapper max-width-12">
            <select className="gf-form-input">
              <option>Loading...</option>
            </select>
          </div>
        </div>
      );
    }

    return (
      <>
        <VariableQueryField
          value={this.state.selectedQueryType}
          options={this.queryTypes}
          onChange={(value) => this.onQueryTypeChange(value)}
          label="Query Type"
        />
        {this.renderQueryTypeSwitch(this.state.selectedQueryType)}
      </>
    );
  }
}
