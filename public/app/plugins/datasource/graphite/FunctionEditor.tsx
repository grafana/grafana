import React from 'react';
import { PopperController, Popper } from '@grafana/ui';
import rst2html from 'rst2html';
import { FunctionDescriptor, FunctionEditorControlsProps, FunctionEditorControls } from './FunctionEditorControls';

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

  renderContent = ({ updatePopperPosition }) => {
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
          <div
            dangerouslySetInnerHTML={{
              __html: rst2html(description),
            }}
          />
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
      <PopperController content={this.renderContent} placement="top" hideAfter={300}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {this.triggerRef && (
                <Popper
                  {...popperProps}
                  referenceElement={this.triggerRef.current}
                  wrapperClassName="popper"
                  className="popper__background"
                  onMouseLeave={() => {
                    this.setState({ showingDescription: false });
                    hidePopper();
                  }}
                  onMouseEnter={showPopper}
                  renderArrow={({ arrowProps, placement }) => (
                    <div className="popper__arrow" data-placement={placement} {...arrowProps} />
                  )}
                />
              )}

              <span
                ref={this.triggerRef}
                onClick={popperProps.show ? hidePopper : showPopper}
                onMouseLeave={() => {
                  hidePopper();
                  this.setState({ showingDescription: false });
                }}
                style={{ cursor: 'pointer' }}
              >
                {this.props.func.def.name}
              </span>
            </>
          );
        }}
      </PopperController>
    );
  }
}

export { FunctionEditor };
