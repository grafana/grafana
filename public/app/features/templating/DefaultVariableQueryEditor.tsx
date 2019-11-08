import React, { PureComponent } from 'react';
import { VariableQueryProps } from 'app/types/plugins';

export default class DefaultVariableQueryEditor extends PureComponent<VariableQueryProps, any> {
  constructor(props: VariableQueryProps) {
    super(props);
    this.state = { value: props.query };
  }

  onChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    this.setState({ value: event.currentTarget.value });
  };

  onBlur = (event: React.FormEvent<HTMLTextAreaElement>) => {
    this.props.onChange(event.currentTarget.value, event.currentTarget.value);
  };

  getLineCount() {
    const { value } = this.state;

    if (typeof value === 'string') {
      return value.split('\n').length;
    }

    return 1;
  }

  render() {
    return (
      <div className="gf-form">
        <span className="gf-form-label width-10">Query</span>
        <textarea
          rows={this.getLineCount()}
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
