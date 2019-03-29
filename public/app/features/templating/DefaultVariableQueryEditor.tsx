import React, { PureComponent } from 'react';
import { Input } from '@grafana/ui';
import { VariableQueryProps } from 'app/types/plugins';

export default class DefaultVariableQueryEditor extends PureComponent<VariableQueryProps, any> {
  constructor(props) {
    super(props);
    this.state = { value: props.query };
  }

  onChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ value: event.currentTarget.value });
  };

  onBlur = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.onChange(event.currentTarget.value, event.currentTarget.value);
  };

  render() {
    return (
      <div className="gf-form">
        <span className="gf-form-label width-10">Query</span>
        <Input
          type="text"
          className="gf-form-input"
          value={this.state.value}
          onChange={this.onChange}
          onBlur={this.onBlur}
          placeholder="metric name or tags query"
          required
        />
      </div>
    );
  }
}
