import React, { Component } from 'react';
import { debounce } from 'lodash';
import { Input } from '@grafana/ui';

export interface Props {
  onChange: (alignmentPeriod: string) => void;
  value: string;
}

export interface State {
  value: string;
}

export class AliasBy extends Component<Props, State> {
  propagateOnChange: (value: any) => void;

  constructor(props: Props) {
    super(props);
    this.propagateOnChange = debounce(this.props.onChange, 500);
    this.state = { value: '' };
  }

  componentDidMount() {
    this.setState({ value: this.props.value });
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.value !== this.props.value) {
      this.setState({ value: nextProps.value });
    }
  }

  onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: e.target.value });
    this.propagateOnChange(e.target.value);
  };

  render() {
    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label query-keyword width-9">Alias By</label>
            <Input type="text" className="gf-form-input width-24" value={this.state.value} onChange={this.onChange} />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </>
    );
  }
}
