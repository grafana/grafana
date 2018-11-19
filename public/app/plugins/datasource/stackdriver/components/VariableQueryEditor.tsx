import React, { PureComponent } from 'react';
import uniqBy from 'lodash/uniqBy';
import { VariableQueryProps } from 'app/types/plugins';
import SimpleSelect from './SimpleSelect';
import { getMetricTypes } from '../functions';
import { MetricFindQueryTypes, VariableQueryData } from '../types';

export class StackdriverVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
  queryTypes: Array<{ value: string; name: string }> = [
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
      ...await this.getLabelValues(selectedMetricType),
    };
    this.setState(state);
  }

  async handleQueryTypeChange(event) {
    const state: any = {
      selectedQueryType: event.target.value,
      ...await this.getLabelValues(this.state.selectedMetricType, event.target.value),
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
      ...await this.getLabelValues(selectedMetricType),
    };
    this.setState(state);
  }

  async onMetricTypeChange(event) {
    const state: any = { selectedMetricType: event.target.value, ...await this.getLabelValues(event.target.value) };
    this.setState(state);
  }

  onLabelKeyChange(event) {
    this.setState({ labelKey: event.target.value });
  }

  componentDidUpdate() {
    const { metricDescriptors, labels, metricTypes, services, ...queryModel } = this.state;
    const query = this.queryTypes.find(q => q.value === this.state.selectedQueryType);
    this.props.onChange(queryModel, `Stackdriver - ${query.name}`);
  }

  async getLabelValues(selectedMetricType, selectedQueryType = this.state.selectedQueryType) {
    let result = { labels: this.state.labels, labelKey: this.state.labelKey };
    if (selectedMetricType && selectedQueryType === MetricFindQueryTypes.LabelValues) {
      const refId = 'StackdriverVariableQueryEditor';
      const response = await this.props.datasource.getLabels(selectedMetricType, refId);
      const labels = [...Object.keys(response.meta.resourceLabels), ...Object.keys(response.meta.metricLabels)];
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
            onValueChange={e => this.onServiceChange(e)}
            label="Services"
          />
        );
      case MetricFindQueryTypes.LabelKeys:
      case MetricFindQueryTypes.LabelValues:
      case MetricFindQueryTypes.ResourceTypes:
        return (
          <React.Fragment>
            <SimpleSelect
              value={this.state.selectedService}
              options={this.state.services}
              onValueChange={e => this.onServiceChange(e)}
              label="Services"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.state.metricTypes}
              onValueChange={e => this.onMetricTypeChange(e)}
              label="Metric Types"
            />
            {queryType === MetricFindQueryTypes.LabelValues && (
              <SimpleSelect
                value={this.state.labelKey}
                options={this.state.labels.map(l => ({ value: l, name: l }))}
                onValueChange={e => this.onLabelKeyChange(e)}
                label="Label Keys"
              />
            )}
          </React.Fragment>
        );
      case MetricFindQueryTypes.Aligners:
      case MetricFindQueryTypes.Aggregations:
        return (
          <React.Fragment>
            <SimpleSelect
              value={this.state.selectedService}
              options={this.state.services}
              onValueChange={e => this.onServiceChange(e)}
              label="Services"
            />
            <SimpleSelect
              value={this.state.selectedMetricType}
              options={this.state.metricTypes}
              onValueChange={e => this.onMetricTypeChange(e)}
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
          onValueChange={e => this.handleQueryTypeChange(e)}
          label="Query Types"
        />
        {this.renderQueryTypeSwitch(this.state.selectedQueryType)}
      </React.Fragment>
    );
  }
}
