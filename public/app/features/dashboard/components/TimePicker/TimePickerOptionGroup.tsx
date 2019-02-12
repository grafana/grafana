import React, { PureComponent, createRef } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';

interface Props extends GroupProps<any> {
  data: {
    label: string;
    options: any[];
    onCustomClick: (ref: any) => void;
  };
}

export class TimePickerOptionGroup extends PureComponent<Props> {
  pickerTriggerRef = createRef<HTMLDivElement>();
  onClick = () => {
    this.props.data.onCustomClick(this.pickerTriggerRef);
  };

  render() {
    const { children, label } = this.props;

    return (
      <div className="gf-form-select-box__option-group">
        <div className="gf-form-select-box__option-group__header" ref={this.pickerTriggerRef} onClick={this.onClick}>
          <span className="flex-grow-1">{label}</span>
          <i className="fa fa-calendar fa-fw" />
        </div>
        {children}
      </div>
    );
  }
}
