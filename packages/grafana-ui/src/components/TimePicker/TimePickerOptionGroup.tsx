import React, { PureComponent } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';

interface Props extends GroupProps<any> {
  data: {
    label: string;
    options: any[];
    onCustomClick: () => void;
  };
}

export class TimePickerOptionGroup extends PureComponent<Props> {
  onClick = () => {
    this.props.data.onCustomClick();
  };

  render() {
    const { children, label } = this.props;

    return (
      <div className="gf-form-select-box__option-group">
        <div className="gf-form-select-box__option-group__header" onClick={this.onClick}>
          <span className="flex-grow-1">{label}</span>
          <i className={'fa fa-calendar fa-fw'} />
        </div>
        {children}
      </div>
    );
  }
}
