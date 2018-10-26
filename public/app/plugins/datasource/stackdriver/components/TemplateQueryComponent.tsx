import React, { PureComponent } from 'react';
import StackdriverDatasource from '../datasource';
import ServiceSelector from './ServiceSelector';
import MetricTypeSelector from './MetricTypeSelector';

interface Props {
  datasource: StackdriverDatasource;
  query: any;
  onChange: (c: string) => void;
}

export class StackdriverTemplateQueryComponent extends PureComponent<Props, any> {
  queryTypes: Array<{ value: string; name: string }> = [
    { value: 'services', name: 'Services' },
    { value: 'metricTypes', name: 'Metric Types' },
    { value: 'metricLabels', name: 'Metric labels For Metric Type' },
  ];

  constructor(props) {
    super(props);
    this.handleQueryTypeChange = this.handleQueryTypeChange.bind(this);
    this.onServiceChange = this.onServiceChange.bind(this);
    this.onMetricTypeChange = this.onMetricTypeChange.bind(this);
    this.state = { queryType: undefined, metricDescriptors: [], service: undefined, metricType: undefined };
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
    this.setState({ metricDescriptors });
  }

  handleQueryTypeChange(event) {
    this.setState({ queryType: event.target.value });
  }

  onServiceChange(event) {
    this.setState({ service: event.target.value });
  }

  onMetricTypeChange(event) {
    this.setState({ metricType: event.target.value });
  }

  renderSwitch(queryType) {
    switch (queryType) {
      case 'metricTypes':
        return (
          <ServiceSelector metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />
        );
      case 'metricLabels':
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
        {this.renderSwitch(this.state.queryType)}
      </React.Fragment>
    );
  }
}
