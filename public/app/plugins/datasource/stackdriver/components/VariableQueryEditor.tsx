import React, { ChangeEvent, PureComponent } from 'react';
import { VariableQueryProps } from 'app/types/plugins';
import SimpleSelect from './SimpleSelect';
import { getMetricTypes, getLabelKeys, extractServicesFromMetricDescriptors } from '../functions';
import { MetricFindQueryTypes, VariableQueryData } from '../types';

export class StackdriverVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
  queryTypes: Array<{ value: string; name: string }> = [
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
  };

  constructor(props: VariableQueryProps) {
    super(props);
    this.state = Object.assign(this.defaults, this.props.query);
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
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
      ...(await this.getLabels(selectedMetricType)),
    };
    this.setState(state);
  }

  async onQueryTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const state: any = {
      selectedQueryType: event.target.value,
      ...(await this.getLabels(this.state.selectedMetricType, event.target.value)),
    };
    this.setState(state);
  }

  async onServiceChange(event: ChangeEvent<HTMLSelectElement>) {
    const { metricTypes, selectedMetricType } = getMetricTypes(
      this.state.metricDescriptors,
      this.state.selectedMetricType,
      this.props.templateSrv.replace(this.state.selectedMetricType),
      this.props.templateSrv.replace(event.target.value)
    );
    const state: any = {
      selectedService: event.target.value,
      metricTypes,
      selectedMetricType,
      ...(await this.getLabels(selectedMetricType)),
    };
    this.setState(state);
  }

  async onMetricTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const state: any = { selectedMetricType: event.target.value, ...(await this.getLabels(event.target.value)) };
    this.setState(state);
  }

  onLabelKeyChange(event: ChangeEvent<HTMLSelectElement>) {
    this.setState({ labelKey: event.target.value });
  }

  componentDidUpdate() {
    const { metricDescriptors, labels, metricTypes, services, ...queryModel } = this.state;
    const query = this.queryTypes.find(q => q.value === this.state.selectedQueryType);
    this.props.onChange(queryModel, `Stackdriver - ${query.name}`);
  }

  async getLabels(selectedMetricType: string, selectedQueryType = this.state.selectedQueryType) {
    let result = { labels: this.state.labels, labelKey: this.state.labelKey };
    if (selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues) {
      const labels = await getLabelKeys(this.props.datasource, selectedMetricType);
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
          <SimpleSelect
            value={this.state.selectedService}
            options={this.insertTemplateVariables(this.state.services)}
            onValueChange={e => this.onServiceChange(e)}
            label="Service"
          />
        );
      case MetricFindQueryTypes.LabelKeys:
      case MetricFindQueryTypes.LabelValues:
      case MetricFindQueryTypes.ResourceTypes:
        return (
          <>
            <SimpleSelect
              value={this.state.selectedService}
              options={this.insertTemplateVariables(this.state.services)}
              onValueChange={e => this.onServiceChange(e)}
              label="Service"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.insertTemplateVariables(this.state.metricTypes)}
              onValueChange={e => this.onMetricTypeChange(e)}
              label="Metric Type"
            />
            {queryType === MetricFindQueryTypes.LabelValues && (
              <SimpleSelect
                value={this.state.labelKey}
                options={this.insertTemplateVariables(this.state.labels.map(l => ({ value: l, name: l })))}
                onValueChange={e => this.onLabelKeyChange(e)}
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
              onValueChange={e => this.onServiceChange(e)}
              label="Service"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.insertTemplateVariables(this.state.metricTypes)}
              onValueChange={e => this.onMetricTypeChange(e)}
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
          onValueChange={e => this.onQueryTypeChange(e)}
          label="Query Type"
        />
        {this.renderQueryTypeSwitch(this.state.selectedQueryType)}
      </>
    );
  }
}
