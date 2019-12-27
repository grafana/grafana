import React, { Component } from 'react';
import { debounce } from 'lodash';
import { Input } from '@grafana/ui';

export interface Props {
  onChange: (alignmentPeriod: any) => void;
  value: string;
}

export interface State {
  value: string;
  initialValue: string;
}

export class AliasBy extends Component<Props, State> {
  propagateOnChange: (value: any) => void;

  constructor(props: Props) {
    super(props);
    this.propagateOnChange = debounce(this.props.onChange, 500);
    this.state = { value: '', initialValue: '' };
  }

  componentDidMount() {
    const { value } = this.props;
    this.setState({ value, initialValue: value });
  }

  static getDerivedStateFromProps({ value }: Props, { initialValue }: State) {
    return value !== initialValue
      ? {
          value,
          initialValue: value,
        }
      : null;
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
