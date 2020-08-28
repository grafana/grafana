import React, { Suspense } from 'react';
import { PopoverController, Popover, ClickOutsideWrapper } from '@grafana/ui';
import { FunctionDescriptor, FunctionEditorControls, FunctionEditorControlsProps } from './FunctionEditorControls';

interface FunctionEditorProps extends FunctionEditorControlsProps {
  func: FunctionDescriptor;
}

interface FunctionEditorState {
  showingDescription: boolean;
}
const FunctionDescription = React.lazy(async () => {
  // @ts-ignore
  const { default: rst2html } = await import(/* webpackChunkName: "rst2html" */ 'rst2html');
  return {
    default: (props: { description?: string }) => (
      <div dangerouslySetInnerHTML={{ __html: rst2html(props.description ?? '') }} />
    ),
  };
});

class FunctionEditor extends React.PureComponent<FunctionEditorProps, FunctionEditorState> {
  private triggerRef = React.createRef<HTMLSpanElement>();

  constructor(props: FunctionEditorProps) {
    super(props);

    this.state = {
      showingDescription: false,
    };
  }

  renderContent = ({ updatePopperPosition }: any) => {
    const {
      onMoveLeft,
      onMoveRight,
      func: {
        def: { name, description },
      },
    } = this.props;
    const { showingDescription } = this.state;

    if (showingDescription) {
      return (
        <div style={{ overflow: 'auto', maxHeight: '30rem', textAlign: 'left', fontWeight: 'normal' }}>
          <h4 style={{ color: 'white' }}> {name} </h4>
          <Suspense fallback={<span>Loading description...</span>}>
            <FunctionDescription description={description} />
          </Suspense>
        </div>
      );
    }

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
        onDescriptionShow={() => {
          this.setState({ showingDescription: true }, () => {
            updatePopperPosition();
          });
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
                  onMouseLeave={() => {
                    this.setState({ showingDescription: false });
                  }}
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
                  onMouseLeave={() => {
                    this.setState({ showingDescription: false });
                  }}
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
