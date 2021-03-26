import React from 'react';
import { PopoverController, Popover, ClickOutsideWrapper } from '@grafana/ui';
import { FunctionDescriptor, FunctionEditorControls, FunctionEditorControlsProps } from './FunctionEditorControls';

interface FunctionEditorProps extends FunctionEditorControlsProps {
  func: FunctionDescriptor;
}

interface FunctionEditorState {
  showingDescription: boolean;
}

class FunctionEditor extends React.PureComponent<FunctionEditorProps, FunctionEditorState> {
  private triggerRef = React.createRef<HTMLSpanElement>();

  constructor(props: FunctionEditorProps) {
    super(props);

    this.state = {
      showingDescription: false,
    };
  }

  renderContent = ({ updatePopperPosition }: any) => {
    const { onMoveLeft, onMoveRight } = this.props;

    return (
      <FunctionEditorControls
        {...this.props}
        onMoveLeft={() => {
          onMoveLeft(this.props.func);
          updatePopperPosition();
        }}
        onMoveRight={() => {
          onMoveRight(this.props.func);
          updatePopperPosition();
        }}
      />
    );
  };

  render() {
    return (
      <PopoverController content={this.renderContent} placement="top" hideAfter={100}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {this.triggerRef.current && (
                <Popover
                  {...popperProps}
                  referenceElement={this.triggerRef.current}
                  wrapperClassName="popper"
                  className="popper__background"
                  renderArrow={({ arrowProps, placement }) => (
                    <div className="popper__arrow" data-placement={placement} {...arrowProps} />
                  )}
                />
              )}
              <ClickOutsideWrapper
                onClick={() => {
                  if (popperProps.show) {
                    hidePopper();
                  }
                }}
              >
                <span
                  ref={this.triggerRef}
                  onClick={popperProps.show ? hidePopper : showPopper}
                  style={{ cursor: 'pointer' }}
                >
                  {this.props.func.def.name}
                </span>
              </ClickOutsideWrapper>
            </>
          );
        }}
      </PopoverController>
    );
  }
}

export { FunctionEditor };
