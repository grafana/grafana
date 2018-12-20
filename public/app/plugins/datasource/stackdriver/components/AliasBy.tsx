import React, { Component } from 'react';
import { debounce } from 'lodash';

export interface Props {
  onChange: (alignmentPeriod) => void;
  value: string;
}

export interface State {
  value: string;
}

export class AliasBy extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.onChange = debounce(this.onChange.bind(this), 500);
    this.state = { value: '' };
  }

  componentDidMount() {
    this.setState({ value: this.props.value });
  }

  handleChange(e) {
    this.setState({ value: e.target.value });
    this.onChange(e.target.value);
  }

  onChange(value) {
    this.props.onChange(value);
  }

  render() {
    return (
      <React.Fragment>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label query-keyword width-9">Alias By</label>
            <input
              type="text"
              className="gf-form-input width-24"
              value={this.state.value}
              onChange={this.handleChange}
            />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </React.Fragment>
    );
  }
}
