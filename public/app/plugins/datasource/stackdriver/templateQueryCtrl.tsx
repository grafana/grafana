import React, { PureComponent } from 'react';
import StackdriverDatasource from './datasource';

interface Props {
  datasource: StackdriverDatasource;
  query: string;
  onChange: (c: string) => void;
}

export class StackdriverTemplateQueryCtrl extends PureComponent<Props, any> {
  constructor(props) {
    super(props);
  }

  async componentDidMount() {
    const metricDescriptors = await this.props.datasource.getMetricTypes(this.props.datasource.projectName);
    console.log(metricDescriptors);
  }

  render() {
    return (
      <div className="gf-form">
        <span className="gf-form-label width-7">Query</span>
        <input
          type="text"
          className="gf-form-input"
          // value={this.state.value}
          // onChange={this.handleChange}
          // onBlur={this.handleBlur}
          placeholder="metric name or tags query"
          required
        />
      </div>
    );
  }
}
