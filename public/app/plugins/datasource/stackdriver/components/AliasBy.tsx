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
    this.updateQuery = debounce(this.updateQuery.bind(this), 500);
    this.state = { value: '' };
  }

  componentDidMount() {
    this.setState({ value: this.props.value });
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.value !== this.props.value) {
      this.setState({ value: nextProps.value });
    }
  }

  onChange(e) {
    this.setState({ value: e.target.value });
    this.updateQuery(e.target.value);
  }

  updateQuery(value) {
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
              onChange={e => this.onChange(e)}
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
