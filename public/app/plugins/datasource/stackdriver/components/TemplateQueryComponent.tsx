import React, { PureComponent } from 'react';
import ServiceSelector from './ServiceSelector';
import MetricTypeSelector from './MetricTypeSelector';
import SimpleDropdown from './SimpleDropdown';
import { TemplateQueryProps } from 'app/types/plugins';
import defaultsDeep from 'lodash/defaultsDeep';
import has from 'lodash/has';
import { MetricFindQueryTypes } from '../types';

export class StackdriverTemplateQueryComponent extends PureComponent<TemplateQueryProps, any> {
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

  defaults = {
    type: '',
    metricDescriptors: [],
    service: '',
    metricType: '',
    metricLabels: [],
    resourceLabels: [],
    metricLabelKey: '',
    resourceLabelKey: '',
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
    this.setState({ metricDescriptors });
  }

  async loadTimeSeriesData() {
    const refId = 'StackdriverTemplateQueryComponent';
    const response = await this.props.datasource.getLabels(this.state.metricType, refId);
    if (this.isLabelQuery(this.state.type) && has(response, `meta.${this.state.type}`)) {
      this.setState({ [this.state.type]: Object.keys(response.meta[this.state.type]) });
    }
  }

  handleQueryTypeChange(event) {
    this.setState({ type: event.target.value });
    if (this.isLabelQuery(event.target.value)) {
      this.loadTimeSeriesData();
    }
  }

  onServiceChange(event) {
    this.setState({ service: event.target.value });
  }

  onMetricTypeChange(event) {
    this.setState({ metricType: event.target.value });
    if (this.isLabelQuery(this.state.type)) {
      this.loadTimeSeriesData();
    }
  }

  onLabelKeyChange(event) {
    const key = this.state.type === MetricFindQueryTypes.MetricLabels ? 'metricLabelKey' : 'resourceLabelKey';
    this.setState({ [key]: event.target.value });
  }

  componentDidUpdate() {
    const { metricDescriptors, metricLabels, resourceLabels, ...queryModel } = this.state;
    this.props.onChange(queryModel);
  }

  isLabelQuery(queryType) {
    return [MetricFindQueryTypes.MetricLabels, MetricFindQueryTypes.ResourceLabels].indexOf(queryType) !== -1;
  }

  getDropdown(queryType) {
    switch (queryType) {
      case MetricFindQueryTypes.ResourceLabels:
        return (
          <SimpleDropdown
            value={this.state.resourceLabelKey}
            options={this.state.resourceLabels}
            onValueChange={this.onLabelKeyChange}
            label="Resource Labels"
          />
        );
      case MetricFindQueryTypes.MetricLabels:
        return (
          <SimpleDropdown
            value={this.state.metricLabelKey}
            options={this.state.metricLabels}
            onValueChange={this.onLabelKeyChange}
            label="Metric Labels"
          />
        );
      default:
        return '';
    }
  }

  renderQueryTypeSwitch(queryType) {
    switch (queryType) {
      case MetricFindQueryTypes.MetricTypes:
        return (
          <ServiceSelector metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />
        );
      case MetricFindQueryTypes.MetricLabels:
      case MetricFindQueryTypes.ResourceLabels:
      case MetricFindQueryTypes.ResourceTypes:
        const dropdown = this.getDropdown(queryType);
        return (
          <React.Fragment>
            <ServiceSelector metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />
            <MetricTypeSelector
              selectedService={this.state.service}
              metricDescriptors={this.state.metricDescriptors}
              onMetricTypeChange={this.onMetricTypeChange}
            />
            {dropdown}
          </React.Fragment>
        );
      case MetricFindQueryTypes.Alignerns:
      case MetricFindQueryTypes.Aggregations:
        return (
          <React.Fragment>
            <ServiceSelector metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />
            <MetricTypeSelector
              selectedService={this.state.service}
              metricDescriptors={this.state.metricDescriptors}
              onMetricTypeChange={this.onMetricTypeChange}
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
        <div className="gf-form max-width-21">
          <span className="gf-form-label width-7">Query Type</span>
          <div className="gf-form-select-wrapper max-width-14">
            <select className="gf-form-input" required onChange={this.handleQueryTypeChange}>
              {this.queryTypes.map((qt, i) => (
                <option key={i} value={qt.value} ng-if="false">
                  {qt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {this.renderQueryTypeSwitch(this.state.type)}
      </React.Fragment>
    );
  }
}
