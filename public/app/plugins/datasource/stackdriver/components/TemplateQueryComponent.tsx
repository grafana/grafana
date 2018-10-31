import React, { PureComponent } from 'react';
import { TemplateQueryProps } from 'app/types/plugins';
import defaultsDeep from 'lodash/defaultsDeep';
import SimpleSelect from './SimpleSelect';
import { getMetricTypes, extractServicesFromMetricDescriptors } from '../functions';
import { MetricFindQueryTypes, TemplateQueryComponentData } from '../types';

export class StackdriverTemplateQueryComponent extends PureComponent<TemplateQueryProps, TemplateQueryComponentData> {
  queryTypes: Array<{ value: string; name: string }> = [
    { value: MetricFindQueryTypes.Services, name: 'Services' },
    { value: MetricFindQueryTypes.MetricTypes, name: 'Metric Types' },
    { value: MetricFindQueryTypes.MetricLabels, name: 'Metric Labels' },
    { value: MetricFindQueryTypes.ResourceLabels, name: 'Resource Labels' },
    { value: MetricFindQueryTypes.ResourceTypes, name: 'Resource Types' },
    { value: MetricFindQueryTypes.Aggregations, name: 'Aggregations' },
    { value: MetricFindQueryTypes.Alignerns, name: 'Aligners' },
    { value: MetricFindQueryTypes.AlignmentPeriods, name: 'Alignment Periods' },
  ];

  defaults: TemplateQueryComponentData = {
    selectedQueryType: '',
    metricDescriptors: [],
    selectedService: '',
    selectedMetricType: '',
    labels: [],
    labelKey: '',
    metricTypes: [],
    services: [],
  };

  constructor(props: TemplateQueryProps) {
    super(props);
    this.handleQueryTypeChange = this.handleQueryTypeChange.bind(this);
    this.onServiceChange = this.onServiceChange.bind(this);
    this.onMetricTypeChange = this.onMetricTypeChange.bind(this);
    this.onLabelKeyChange = this.onLabelKeyChange.bind(this);
    this.state = defaultsDeep(this.props.query, this.defaults);
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
    const services = extractServicesFromMetricDescriptors(metricDescriptors).map(m => ({
      value: m.service,
      name: m.serviceShortName,
    }));
    const selectedService = services.some(s => s.value === this.state.selectedService)
      ? this.state.selectedService
      : services[0].value;
    const { metricTypes, selectedMetricType } = getMetricTypes(
      metricDescriptors,
      this.state.selectedMetricType,
      selectedService
    );
    const state: any = {
      services,
      selectedService,
      metricTypes,
      selectedMetricType,
      metricDescriptors,
      ...await this.getLabels(this.state.selectedMetricType),
    };
    this.setState(state);
  }

  async handleQueryTypeChange(event) {
    const state: any = {
      selectedQueryType: event.target.value,
      ...await this.getLabels(this.state.selectedMetricType, event.target.value),
    };
    this.setState(state);
  }

  async onServiceChange(event) {
    const { metricTypes, selectedMetricType } = getMetricTypes(
      this.state.metricDescriptors,
      this.state.selectedMetricType,
      event.target.value
    );
    const state: any = {
      selectedService: event.target.value,
      metricTypes,
      selectedMetricType,
      ...await this.getLabels(selectedMetricType),
    };
    this.setState(state);
  }

  async onMetricTypeChange(event) {
    const state: any = { selectedMetricType: event.target.value, ...await this.getLabels(event.target.value) };
    this.setState(state);
  }

  onLabelKeyChange(event) {
    this.setState({ labelKey: event.target.value });
  }

  componentDidUpdate() {
    const { metricDescriptors, labels, ...queryModel } = this.state;
    this.props.onChange(queryModel);
  }

  isLabelQuery(queryType) {
    return [MetricFindQueryTypes.MetricLabels, MetricFindQueryTypes.ResourceLabels].indexOf(queryType) !== -1;
  }

  async getLabels(selectedMetricType, selectedQueryType = this.state.selectedQueryType) {
    let result = { labels: this.state.labels, labelKey: this.state.labelKey };
    if (this.isLabelQuery(selectedQueryType)) {
      const refId = 'StackdriverTemplateQueryComponent';
      const response = await this.props.datasource.getLabels(selectedMetricType, refId);
      const labels = Object.keys(response.meta[selectedQueryType]);
      const labelKey = labels.some(l => l === this.state.labelKey) ? this.state.labelKey : labels[0];
      result = { labels, labelKey };
    }
    return result;
  }

  servicePicker = (
    <SimpleSelect
      value={this.state.selectedService}
      options={this.state.services}
      onValueChange={this.onServiceChange}
      label="Services"
    />
  );

  metricTypesPicker = (
    <SimpleSelect
      value={this.state.selectedMetricType}
      options={this.state.metricTypes}
      onValueChange={this.onMetricTypeChange}
      label="Metric Types"
    />
  );

  labelPicker = (
    <SimpleSelect
      value={this.state.labelKey}
      options={this.state.labels.map(l => ({ value: l, name: l }))}
      onValueChange={this.onLabelKeyChange}
      label={
        this.state.selectedQueryType === MetricFindQueryTypes.ResourceLabels ? 'Resource Label Key' : 'Metric Label Key'
      }
    />
  );

  renderQueryTypeSwitch(queryType) {
    switch (queryType) {
      case MetricFindQueryTypes.MetricTypes:
        return this.servicePicker;
      case MetricFindQueryTypes.MetricLabels:
      case MetricFindQueryTypes.ResourceLabels:
      case MetricFindQueryTypes.ResourceTypes:
        return (
          <React.Fragment>
            {this.servicePicker}
            {this.metricTypesPicker}
            {queryType !== MetricFindQueryTypes.ResourceTypes && this.labelPicker}
          </React.Fragment>
        );
      case MetricFindQueryTypes.Alignerns:
      case MetricFindQueryTypes.Aggregations:
        return (
          <React.Fragment>
            {this.servicePicker}
            {this.metricTypesPicker}
          </React.Fragment>
        );
      default:
        return '';
    }
  }

  render() {
    return (
      <React.Fragment>
        <SimpleSelect
          value={this.state.selectedQueryType}
          options={this.queryTypes}
          onValueChange={this.handleQueryTypeChange}
          label="Query Types"
        />
        {this.renderQueryTypeSwitch(this.state.selectedQueryType)}
      </React.Fragment>
    );
  }
}
