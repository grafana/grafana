import React, { PureComponent } from 'react';

interface Props {
  query: string;
  onChange: (c: string) => void;
}

export default class DefaultTemplateQueryCtrl extends PureComponent<Props, any> {
  constructor(props) {
    super(props);
    this.state = { value: props.query };
    this.handleChange = this.handleChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  handleBlur(event) {
    this.props.onChange(event.target.value);
  }

  render() {
    return (
      <div className="gf-form">
        <span className="gf-form-label width-7">Query</span>
        <input
          type="text"
          className="gf-form-input"
          value={this.state.value}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          placeholder="metric name or tags query"
          required
        />
      </div>
    );
  }
}
