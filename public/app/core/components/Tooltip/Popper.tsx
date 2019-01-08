import React, { PureComponent } from 'react';
import Portal from 'app/core/components/Portal/Portal';
import { Manager, Popper as ReactPopper, Reference } from 'react-popper';
import Transition from 'react-transition-group/Transition';

export enum Themes {
  Default = 'popper__background--default',
  Error = 'popper__background--error',
}

const defaultTransitionStyles = {
  transition: 'opacity 200ms linear',
  opacity: 0,
};

const transitionStyles = {
  exited: { opacity: 0 },
  entering: { opacity: 0 },
  entered: { opacity: 1 },
  exiting: { opacity: 0 },
};

interface Props {
  renderContent: (content: any) => any;
  show: boolean;
  placement?: any;
  content: string | ((props: any) => JSX.Element);
  refClassName?: string;
  theme?: Themes;
}

class Popper extends PureComponent<Props> {
  render() {
    const { children, renderContent, show, placement, refClassName, theme } = this.props;
    const { content } = this.props;

    const popperBackgroundClassName = 'popper__background' + (theme ? ' ' + theme : '');

    return (
      <Manager>
        <Reference>
          {({ ref }) => (
            <div className={`popper_ref ${refClassName || ''}`} ref={ref}>
              {children}
            </div>
          )}
        </Reference>
        <Transition in={show} timeout={100} mountOnEnter={true} unmountOnExit={true}>
          {transitionState => (
            <Portal>
              <ReactPopper placement={placement}>
                {({ ref, style, placement, arrowProps }) => {
                  return (
                    <div
                      ref={ref}
                      style={{
                        ...style,
                        ...defaultTransitionStyles,
                        ...transitionStyles[transitionState],
                      }}
                      data-placement={placement}
                      className="popper"
                    >
                      <div className={popperBackgroundClassName}>
                        {renderContent(content)}
                        <div ref={arrowProps.ref} data-placement={placement} className="popper__arrow" />
                      </div>
                    </div>
                  );
                }}
              </ReactPopper>
            </Portal>
          )}
        </Transition>
      </Manager>
    );
  }
}

export default Popper;
