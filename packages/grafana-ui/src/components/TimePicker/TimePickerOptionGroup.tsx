import React, { PureComponent, createRef } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';
import { Popper } from '@grafana/ui/src/components/Tooltip/Popper';
import { Props as TimePickerProps, TimePickerPopover } from './TimePickerPopover';
import { TimeRange } from '@grafana/ui';

export interface DataProps {
  onPopoverOpen: () => void;
  onPopoverClose: (timeRange: TimeRange) => void;
  popoverProps: TimePickerProps;
}

interface Props extends GroupProps<any> {
  data: DataProps;
}

interface State {
  isPopoverOpen: boolean;
}

export class TimePickerOptionGroup extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();
  state: State = { isPopoverOpen: false };

  onClick = () => {
    this.setState({ isPopoverOpen: true });
    this.props.data.onPopoverOpen();
  };

  render() {
    const { children, label } = this.props;
    const { isPopoverOpen } = this.state;
    const { onPopoverClose } = this.props.data;
    const popover = TimePickerPopover;
    const popoverElement = React.createElement(popover, {
      ...this.props.data.popoverProps,
      onChange: (timeRange: TimeRange) => {
        onPopoverClose(timeRange);
        this.setState({ isPopoverOpen: false });
      },
    });

    return (
      <>
        <div className="gf-form-select-box__option-group">
          <div className="gf-form-select-box__option-group__header" ref={this.pickerTriggerRef} onClick={this.onClick}>
            <span className="flex-grow-1">{label}</span>
            <i className="fa fa-calendar fa-fw" />
          </div>
          {children}
        </div>
        <div>
          {this.pickerTriggerRef.current && (
            <Popper
              show={isPopoverOpen}
              content={popoverElement}
              referenceElement={this.pickerTriggerRef.current}
              placement={'left-start'}
              wrapperClassName="time-picker-popover-popper"
            />
          )}
        </div>
      </>
    );
  }
}
