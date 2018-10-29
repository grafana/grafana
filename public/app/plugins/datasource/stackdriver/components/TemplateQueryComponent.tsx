import React, { PureComponent } from 'react';
import ServiceSelector from './ServiceSelector';
import MetricTypeSelector from './MetricTypeSelector';
import SimpleDropdown from './SimpleDropdown';
import { TemplateQueryProps } from 'app/types/plugins';
import defaultsDeep from 'lodash/defaultsDeep';
import has from 'lodash/has';

export class StackdriverTemplateQueryComponent extends PureComponent<TemplateQueryProps, any> {
  queryTypes: Array<{ value: string; name: string }> = [
    { value: 'services', name: 'Services' },
    { value: 'metricTypes', name: 'Metric Types' },
    { value: 'metricLabels', name: 'Metric Labels' },
    { value: 'resourceLabels', name: 'Resource Labels' },
    { value: 'resourceTypes', name: 'Resource Types' },
    { value: 'aggregations', name: 'Aggregations' },
    { value: 'alignerns', name: 'Aligners' },
    { value: 'alignmentPeriods', name: 'Alignment Periods' },
  ];

  defaults = {
    type: undefined,
    metricDescriptors: [],
    service: undefined,
    metricType: undefined,
    metricLabels: [],
    resourceLabels: [],
    metricLabelKey: undefined,
    resourceLabelKey: undefined,
  };

  constructor(props: TemplateQueryProps) {
    super(props);
    this.handleQueryTypeChange = this.handleQueryTypeChange.bind(this);
    this.onServiceChange = this.onServiceChange.bind(this);
    this.onMetricTypeChange = this.onMetricTypeChange.bind(this);
    this.onMetricLabelKeyChange = this.onMetricLabelKeyChange.bind(this);
    this.onResourceLabelKeyChange = this.onResourceLabelKeyChange.bind(this);
    this.state = defaultsDeep(this.props.query, this.defaults);
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
    this.setState({ metricDescriptors });
  }

  isLabelQuery(queryType) {
    return ['metricLabels', 'resourceLabels'].indexOf(queryType) !== -1;
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

  onMetricLabelKeyChange(event) {
    this.setState({ metricLabelKey: event.target.value });
  }

  onResourceLabelKeyChange(event) {
    this.setState({ resourceLabelKey: event.target.value });
  }

  componentDidUpdate() {
    const { metricDescriptors, metricLabels, resourceLabels, ...queryModel } = this.state;
    this.props.onChange(queryModel);
  }

  switchMetaType(queryType) {
    switch (queryType) {
      case 'resourceLabels':
        return (
          <SimpleDropdown
            value={this.state.resourceLabelKey}
            options={this.state.resourceLabels}
            onValueChange={this.onResourceLabelKeyChange}
            label="Resource Labels"
          />
        );
      case 'metricLabels':
        return (
          <SimpleDropdown
            value={this.state.metricLabelKey}
            options={this.state.metricLabels}
            onValueChange={this.onMetricLabelKeyChange}
            label="Metric Labels"
          />
        );
      default:
        return '';
    }
  }

  renderSwitch(queryType) {
    switch (queryType) {
      case 'metricTypes':
        return (
          <ServiceSelector metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />
        );
      case 'metricLabels':
      case 'resourceLabels':
      case 'resourceTypes':
        const dropdown = this.switchMetaType(queryType);
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
      case 'alignerns':
      case 'aggregations':
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
        {this.renderSwitch(this.state.type)}
      </React.Fragment>
    );
  }
}
