import React, { PureComponent } from 'react';
import uniqBy from 'lodash/uniqBy';
import { TemplateQueryProps } from 'app/types/plugins';
import SimpleSelect from './SimpleSelect';
import { getMetricTypes } from '../functions';
import { MetricFindQueryTypes, TemplateQueryComponentData } from '../types';

export class StackdriverTemplateQueryComponent extends PureComponent<TemplateQueryProps, TemplateQueryComponentData> {
  queryTypes: Array<{ value: string; name: string }> = [
    { value: MetricFindQueryTypes.MetricTypes, name: 'Metric Types' },
    { value: MetricFindQueryTypes.MetricLabels, name: 'Metric Labels' },
    { value: MetricFindQueryTypes.ResourceLabels, name: 'Resource Labels' },
    { value: MetricFindQueryTypes.ResourceTypes, name: 'Resource Types' },
    { value: MetricFindQueryTypes.Aggregations, name: 'Aggregations' },
    { value: MetricFindQueryTypes.Alignerns, name: 'Aligners' },
    { value: MetricFindQueryTypes.AlignmentPeriods, name: 'Alignment Periods' },
  ];

  defaults: TemplateQueryComponentData = {
    selectedQueryType: this.queryTypes[0].value,
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
    this.state = Object.assign(this.defaults, this.props.query);
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
    const services = uniqBy(metricDescriptors, 'service').map(m => ({
      value: m.service,
      name: m.serviceShortName,
    }));

    let selectedService = '';
    if (services.some(s => s.value === this.state.selectedService)) {
      selectedService = this.state.selectedService;
    } else if (services && services.length > 0) {
      selectedService = services[0].value;
    }

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
      ...await this.getLabels(selectedMetricType),
    };
    console.log(state);
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
    const { metricDescriptors, labels, metricTypes, services, ...queryModel } = this.state;
    const queryName = this.queryTypes.find(q => q.value === this.state.selectedQueryType);
    this.props.onChange(queryModel, `Stackdriver - ${queryName.name}`);
  }

  isLabelQuery(queryType) {
    return [MetricFindQueryTypes.MetricLabels, MetricFindQueryTypes.ResourceLabels].indexOf(queryType) !== -1;
  }

  async getLabels(selectedMetricType, selectedQueryType = this.state.selectedQueryType) {
    let result = { labels: this.state.labels, labelKey: this.state.labelKey };
    if (selectedMetricType && this.isLabelQuery(selectedQueryType)) {
      const refId = 'StackdriverTemplateQueryComponent';
      const response = await this.props.datasource.getLabels(selectedMetricType, refId);
      const labels = Object.keys(response.meta[selectedQueryType]);
      const labelKey = labels.some(l => l === this.state.labelKey) ? this.state.labelKey : labels[0];
      result = { labels, labelKey };
    }
    return result;
  }

  renderQueryTypeSwitch(queryType) {
    switch (queryType) {
      case MetricFindQueryTypes.MetricTypes:
        return (
          <SimpleSelect
            value={this.state.selectedService}
            options={this.state.services}
            onValueChange={this.onServiceChange}
            label="Services"
          />
        );
      case MetricFindQueryTypes.MetricLabels:
      case MetricFindQueryTypes.ResourceLabels:
      case MetricFindQueryTypes.ResourceTypes:
        return (
          <React.Fragment>
            <SimpleSelect
              value={this.state.selectedService}
              options={this.state.services}
              onValueChange={this.onServiceChange}
              label="Services"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.state.metricTypes}
              onValueChange={this.onMetricTypeChange}
              label="Metric Types"
            />
            {queryType !== MetricFindQueryTypes.ResourceTypes && (
              <SimpleSelect
                value={this.state.labelKey}
                options={this.state.labels.map(l => ({ value: l, name: l }))}
                onValueChange={this.onLabelKeyChange}
                label={
                  this.state.selectedQueryType === MetricFindQueryTypes.ResourceLabels
                    ? 'Resource Label Key'
                    : 'Metric Label Key'
                }
              />
            )}
          </React.Fragment>
        );
      case MetricFindQueryTypes.Alignerns:
      case MetricFindQueryTypes.Aggregations:
        return (
          <React.Fragment>
            <SimpleSelect
              value={this.state.selectedService}
              options={this.state.services}
              onValueChange={this.onServiceChange}
              label="Services"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.state.metricTypes}
              onValueChange={this.onMetricTypeChange}
              label="Metric Types"
            />
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
