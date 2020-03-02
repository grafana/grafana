import React, { PureComponent } from 'react';
import { VariableQueryProps } from 'app/types/plugins';
import { SimpleSelect } from './';
import { getMetricTypes, getLabelKeys, extractServicesFromMetricDescriptors } from '../functions';
import { MetricFindQueryTypes, VariableQueryData } from '../types';

export class StackdriverVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
  queryTypes: Array<{ value: string; name: string }> = [
    { value: MetricFindQueryTypes.Projects, name: 'Projects' },
    { value: MetricFindQueryTypes.Services, name: 'Services' },
    { value: MetricFindQueryTypes.MetricTypes, name: 'Metric Types' },
    { value: MetricFindQueryTypes.LabelKeys, name: 'Label Keys' },
    { value: MetricFindQueryTypes.LabelValues, name: 'Label Values' },
    { value: MetricFindQueryTypes.ResourceTypes, name: 'Resource Types' },
    { value: MetricFindQueryTypes.Aggregations, name: 'Aggregations' },
    { value: MetricFindQueryTypes.Aligners, name: 'Aligners' },
    { value: MetricFindQueryTypes.AlignmentPeriods, name: 'Alignment Periods' },
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
    projects: [],
    projectName: '',
  };

  constructor(props: VariableQueryProps) {
    super(props);
    this.state = Object.assign(
      this.defaults,
      { projectName: this.props.datasource.getDefaultProject() },
      this.props.query
    );
  }

  async componentDidMount() {
    const projects = await this.props.datasource.getProjects();
    const metricDescriptors = await this.props.datasource.getMetricTypes(
      this.props.query.projectName || this.props.datasource.getDefaultProject()
    );
    const services = extractServicesFromMetricDescriptors(metricDescriptors).map((m: any) => ({
      value: m.service,
      name: m.serviceShortName,
    }));

    let selectedService = '';
    if (services.some(s => s.value === this.props.templateSrv.replace(this.state.selectedService))) {
      selectedService = this.state.selectedService;
    } else if (services && services.length > 0) {
      selectedService = services[0].value;
    }

    const { metricTypes, selectedMetricType } = getMetricTypes(
      metricDescriptors,
      this.state.selectedMetricType,
      this.props.templateSrv.replace(this.state.selectedMetricType),
      this.props.templateSrv.replace(selectedService)
    );

    const state: any = {
      services,
      selectedService,
      metricTypes,
      selectedMetricType,
      metricDescriptors,
      projects: projects.map(({ value, label }: any) => ({ value, name: label })),
      ...(await this.getLabels(selectedMetricType, this.state.projectName)),
    };
    this.setState(state);
  }

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
      this.props.templateSrv.replace(this.state.selectedMetricType),
      this.props.templateSrv.replace(this.state.selectedService)
    );

    this.setState({ ...labels, metricTypes, selectedMetricType, metricDescriptors, projectName });
  }

  async onServiceChange(service: string) {
    const { metricTypes, selectedMetricType } = getMetricTypes(
      this.state.metricDescriptors,
      this.state.selectedMetricType,
      this.props.templateSrv.replace(this.state.selectedMetricType),
      this.props.templateSrv.replace(service)
    );
    const state: any = {
      selectedService: service,
      metricTypes,
      selectedMetricType,
      ...(await this.getLabels(selectedMetricType, this.state.projectName)),
    };
    this.setState(state);
  }

  async onMetricTypeChange(metricType: string) {
    const state: any = {
      selectedMetricType: metricType,
      ...(await this.getLabels(metricType, this.state.projectName)),
    };
    this.setState(state);
  }

  onLabelKeyChange(labelKey: string) {
    this.setState({ labelKey });
  }

  componentDidUpdate() {
    const { metricDescriptors, labels, metricTypes, services, ...queryModel } = this.state;
    const query = this.queryTypes.find(q => q.value === this.state.selectedQueryType);
    this.props.onChange(queryModel, `Stackdriver - ${query.name}`);
  }

  async getLabels(selectedMetricType: string, projectName: string, selectedQueryType = this.state.selectedQueryType) {
    let result = { labels: this.state.labels, labelKey: this.state.labelKey };
    if (selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues) {
      const labels = await getLabelKeys(this.props.datasource, selectedMetricType, projectName);
      const labelKey = labels.some(l => l === this.props.templateSrv.replace(this.state.labelKey))
        ? this.state.labelKey
        : labels[0];
      result = { labels, labelKey };
    }
    return result;
  }

  insertTemplateVariables(options: any) {
    const templateVariables = this.props.templateSrv.variables.map((v: any) => ({
      name: `$${v.name}`,
      value: `$${v.name}`,
    }));
    return [...templateVariables, ...options];
  }

  renderQueryTypeSwitch(queryType: string) {
    switch (queryType) {
      case MetricFindQueryTypes.MetricTypes:
        return (
          <>
            <SimpleSelect
              value={this.state.projectName}
              options={this.insertTemplateVariables(this.state.projects)}
              onValueChange={e => this.onProjectChange(e.target.value)}
              label="Project"
            />
            <SimpleSelect
              value={this.state.selectedService}
              options={this.insertTemplateVariables(this.state.services)}
              onValueChange={e => this.onServiceChange(e.target.value)}
              label="Service"
            />
          </>
        );
      case MetricFindQueryTypes.LabelKeys:
      case MetricFindQueryTypes.LabelValues:
      case MetricFindQueryTypes.ResourceTypes:
        return (
          <>
            <SimpleSelect
              value={this.state.projectName}
              options={this.insertTemplateVariables(this.state.projects)}
              onValueChange={e => this.onProjectChange(e.target.value)}
              label="Project"
            />
            <SimpleSelect
              value={this.state.selectedService}
              options={this.insertTemplateVariables(this.state.services)}
              onValueChange={e => this.onServiceChange(e.target.value)}
              label="Service"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.insertTemplateVariables(this.state.metricTypes)}
              onValueChange={e => this.onMetricTypeChange(e.target.value)}
              label="Metric Type"
            />
            {queryType === MetricFindQueryTypes.LabelValues && (
              <SimpleSelect
                value={this.state.labelKey}
                options={this.insertTemplateVariables(this.state.labels.map(l => ({ value: l, name: l })))}
                onValueChange={e => this.onLabelKeyChange(e.target.value)}
                label="Label Key"
              />
            )}
          </>
        );
      case MetricFindQueryTypes.Aligners:
      case MetricFindQueryTypes.Aggregations:
        return (
          <>
            <SimpleSelect
              value={this.state.selectedService}
              options={this.insertTemplateVariables(this.state.services)}
              onValueChange={e => this.onServiceChange(e.target.value)}
              label="Service"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.insertTemplateVariables(this.state.metricTypes)}
              onValueChange={e => this.onMetricTypeChange(e.target.value)}
              label="Metric Type"
            />
          </>
        );
      default:
        return '';
    }
  }

  render() {
    return (
      <>
        <SimpleSelect
          value={this.state.selectedQueryType}
          options={this.queryTypes}
          onValueChange={e => this.onQueryTypeChange(e.target.value)}
          label="Query Type"
        />
        {this.renderQueryTypeSwitch(this.state.selectedQueryType)}
      </>
    );
  }
}
