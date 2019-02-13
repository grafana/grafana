import React, { PureComponent, createRef } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';
import Popper from '@grafana/ui/src/components/Tooltip/Popper';
import { Props as TimePickerProps, TimePickerPopOver } from './TimePickerPopOver';
import { TimeRange } from '@grafana/ui';

interface Props extends GroupProps<any> {
  data: {
    isPopoverOpen: boolean;
    onCustomClick: (isSmallScreen: boolean) => void;
    onPopoverClose: (timeRange: TimeRange) => void;
    popoverProps: TimePickerProps;
  };
}

interface State {
  isOpen: boolean;
  isSmallScreen: boolean;
}

export class TimePickerOptionGroup extends PureComponent<Props, State> {
  pickerTriggerRef = createRef<HTMLDivElement>();
  constructor(props: Props) {
    super(props);
    this.state = { isOpen: props.data.isPopoverOpen, isSmallScreen: false };
  }

  componentWillMount() {
    this.setState({ isSmallScreen: window.innerWidth <= 1116 });
  }

  onClick = () => {
    const { isSmallScreen } = this.state;
    this.setState({ isOpen: !this.state.isOpen });
    this.props.data.onCustomClick(isSmallScreen);
  };

  render() {
    const { children, label } = this.props;
    const { isSmallScreen, isOpen } = this.state;
    const { isPopoverOpen, onPopoverClose } = this.props.data;
    const popover = TimePickerPopOver;
    const popoverElement = React.createElement(popover, {
      ...this.props.data.popoverProps,
      onChange: (timeRange: TimeRange) => {
        onPopoverClose(timeRange);
        this.setState({ isOpen: false });
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
              show={isPopoverOpen || isOpen}
              content={popoverElement}
              referenceElement={this.pickerTriggerRef.current}
              placement={isSmallScreen ? 'auto' : 'left-start'}
            />
          )}
        </div>
      </>
    );
  }
}
