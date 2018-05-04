import React from 'react';
import _ from 'lodash';

export interface IProps {
  label: string;
  checked?: boolean;
  labelClass?: string;
  switchClass?: string;
  onChange: (value: any) => any;
}

export class FormSwitch extends React.Component<IProps, any> {
  id: any;

  constructor(props) {
    super(props);

    this.internalOnChange = this.internalOnChange.bind(this);
  }

  componentWillMount() {
    this.id = _.uniqueId();
  }

  internalOnChange(e) {
    const checked = e.target.checked;
    this.props.onChange(checked);
  }

  render() {
    const labelId = 'check-' + this.id;
    const labelClassName = `gf-form-label ${this.props.labelClass} pointer`;
    const switchClassName = `gf-form-switch ${this.props.switchClass}`;

    return (
      <div className="gf-form-switch-react">
        {this.props.label && (
          <label htmlFor={labelId} className={labelClassName}>
            {this.props.label}
          </label>
        )}
        <div className={switchClassName}>
          <input id={labelId} type="checkbox" checked={this.props.checked} onChange={this.internalOnChange} />
          <label htmlFor={labelId} data-on="Yes" data-off="No" />
        </div>
      </div>
    );
  }
}
