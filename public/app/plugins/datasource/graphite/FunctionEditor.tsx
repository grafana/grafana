import React from 'react';
import { PopoverController, Popover, ClickOutsideWrapper, Icon, Tooltip, withTheme, Themeable } from '@grafana/ui';
import { FunctionDescriptor, FunctionEditorControls, FunctionEditorControlsProps } from './FunctionEditorControls';
import { css } from '@emotion/css';

interface FunctionEditorProps extends FunctionEditorControlsProps, Themeable {
  func: FunctionDescriptor;
}

interface FunctionEditorState {
  showingDescription: boolean;
}

class UnthemedFunctionEditor extends React.PureComponent<FunctionEditorProps, FunctionEditorState> {
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
    const { theme } = this.props;
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
                  {this.props.func.def.unknown && (
                    <Tooltip content={<TooltipContent />} placement="bottom">
                      <Icon
                        data-testid="warning-icon"
                        name="exclamation-triangle"
                        size="xs"
                        className={css`
                          margin-right: ${theme.spacing.xxs};
                        `}
                      />
                    </Tooltip>
                  )}
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

const TooltipContent = React.memo(() => {
  return (
    <span>
      This function is not supported. Check your function for typos and{' '}
      <a
        target="_blank"
        className="external-link"
        rel="noreferrer noopener"
        href="https://graphite.readthedocs.io/en/latest/functions.html"
      >
        read the docs
      </a>{' '}
      to see whether you need to upgrade your data source’s version to make this function available.
    </span>
  );
});
TooltipContent.displayName = 'FunctionEditorTooltipContent';

export const FunctionEditor = withTheme(UnthemedFunctionEditor);
FunctionEditor.displayName = 'FunctionEditor';
