import React, { PureComponent } from 'react';
import { VariableQueryProps } from 'app/types/plugins';
import { SimpleSelect } from './';
import { extractServicesFromMetricDescriptors, getLabelKeys, getMetricTypes } from '../functions';
import { MetricFindQueryTypes, VariableQueryData } from '../types';

export class CloudMonitoringVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
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
    { value: MetricFindQueryTypes.Selectors, name: 'Selectors' },
    { value: MetricFindQueryTypes.SLOServices, name: 'SLO Services' },
    { value: MetricFindQueryTypes.SLO, name: 'Service Level Objectives (SLO)' },
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

    const sloServices = await this.props.datasource.getSLOServices(this.state.projectName);

    const state: any = {
      services,
      selectedService,
      metricTypes,
      selectedMetricType,
      metricDescriptors,
      projects: projects.map(({ value, label }: any) => ({ value, name: label })),
      ...(await this.getLabels(selectedMetricType, this.state.projectName)),
      sloServices: sloServices.map(({ value, label }: any) => ({ value, name: label })),
      loading: false,
    };
    this.setState(state, () => this.onPropsChange());
  }

  onPropsChange = () => {
    const { metricDescriptors, labels, metricTypes, services, ...queryModel } = this.state;
    const query = this.queryTypes.find(q => q.value === this.state.selectedQueryType)!;
    this.props.onChange(queryModel, `Google Cloud Monitoring - ${query.name}`);
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
      this.props.templateSrv.replace(this.state.selectedMetricType),
      this.props.templateSrv.replace(this.state.selectedService)
    );

    const sloServices = await this.props.datasource.getSLOServices(projectName);

    this.setState({
      ...labels,
      metricTypes,
      selectedMetricType,
      metricDescriptors,
      projectName,
      sloServices: sloServices.map(({ value, label }: any) => ({ value, name: label })),
    });
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
    this.setState({ labelKey }, () => this.onPropsChange());
  }

  componentDidUpdate(prevProps: Readonly<VariableQueryProps>, prevState: Readonly<VariableQueryData>) {
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
      const labelKey = labels.some(l => l === this.props.templateSrv.replace(this.state.labelKey))
        ? this.state.labelKey
        : labels[0];
      result = { labels, labelKey };
    }
    return result;
  }

  insertTemplateVariables(options: any) {
    const templateVariables = this.props.templateSrv.getVariables().map((v: any) => ({
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
      case MetricFindQueryTypes.SLOServices:
        return (
          <>
            <SimpleSelect
              value={this.state.projectName}
              options={this.insertTemplateVariables(this.state.projects)}
              onValueChange={e => this.onProjectChange(e.target.value)}
              label="Project"
            />
          </>
        );

      case MetricFindQueryTypes.SLO:
        return (
          <>
            <SimpleSelect
              value={this.state.projectName}
              options={this.insertTemplateVariables(this.state.projects)}
              onValueChange={e => this.onProjectChange(e.target.value)}
              label="Project"
            />
            <SimpleSelect
              value={this.state.selectedSLOService}
              options={this.insertTemplateVariables(this.state.sloServices)}
              onValueChange={e => {
                this.setState({
                  ...this.state,
                  selectedSLOService: e.target.value,
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
