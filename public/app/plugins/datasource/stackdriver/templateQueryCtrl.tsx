import React, { PureComponent } from 'react';
import StackdriverDatasource from './datasource';
import Services from './services';
import MetricTypes from './metricTypes';

interface Props {
  datasource: StackdriverDatasource;
  query: string;
  onChange: (c: string) => void;
}

export class StackdriverTemplateQueryCtrl extends PureComponent<Props, any> {
  queryTypes: Array<{ value: string; name: string }> = [
    { value: 'services', name: 'Services' },
    { value: 'metricTypes', name: 'Metric Types' },
    { value: 'metricLabels', name: 'Metric labels For Metric Type' },
  ];

  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.onServiceChange = this.onServiceChange.bind(this);
    this.onMetricTypeChanged = this.onMetricTypeChanged.bind(this);
    this.state = { queryType: undefined, metricDescriptors: [], service: undefined, metricType: undefined };
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
    this.setState({ metricDescriptors });
  }

  handleChange(event) {
    this.setState({ queryType: event.target.value });
  }

  onServiceChange(event) {
    this.setState({ service: event.target.value });
  }

  onMetricTypeChanged(event) {
    this.setState({ metricType: event.target.value });
  }

  renderSwitch(queryType) {
    switch (queryType) {
      case 'metricTypes':
        return <Services metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />;
      case 'metricLabels':
        return (
          <React.Fragment>
            <Services metricDescriptors={this.state.metricDescriptors} onServiceChange={this.onServiceChange} />
            <MetricTypes
              selectedService={this.state.service}
              metricDescriptors={this.state.metricDescriptors}
              onMetricTypeChanged={this.onMetricTypeChanged}
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
            <select className="gf-form-input" required onChange={this.handleChange}>
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
