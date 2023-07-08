import { Placement, VirtualElement } from '@popperjs/core';
import React, { PureComponent } from 'react';
import { Manager, Popper as ReactPopper, PopperArrowProps } from 'react-popper';
import Transition from 'react-transition-group/Transition';

import { Portal } from '../Portal/Portal';

import { PopoverContent } from './types';

const defaultTransitionStyles = {
  transitionProperty: 'opacity',
  transitionDuration: '200ms',
  transitionTimingFunction: 'linear',
  opacity: 0,
};

const transitionStyles: { [key: string]: object } = {
  exited: { opacity: 0 },
  entering: { opacity: 0 },
  entered: { opacity: 1, transitionDelay: '0s' },
  exiting: { opacity: 0, transitionDelay: '500ms' },
};

export type RenderPopperArrowFn = (props: { arrowProps: PopperArrowProps; placement: string }) => JSX.Element;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  show: boolean;
  placement?: Placement;
  content: PopoverContent;
  referenceElement: HTMLElement | VirtualElement;
  wrapperClassName?: string;
  renderArrow?: RenderPopperArrowFn;
}

class Popover extends PureComponent<Props> {
  render() {
    const {
      content,
      show,
      placement,
      onMouseEnter,
      onMouseLeave,
      className,
      wrapperClassName,
      renderArrow,
      referenceElement,
      onKeyDown,
    } = this.props;

    return (
      <Manager>
        <Transition in={show} timeout={100} mountOnEnter={true} unmountOnExit={true}>
          {(transitionState) => {
            return (
              <Portal>
                <ReactPopper
                  placement={placement}
                  referenceElement={referenceElement}
                  modifiers={[
                    { name: 'preventOverflow', enabled: true, options: { rootBoundary: 'viewport' } },
                    {
                      name: 'eventListeners',
                      options: { scroll: true, resize: true },
                    },
                  ]}
                >
                  {({ ref, style, placement, arrowProps, update }) => {
                    return (
                      // TODO: fix keyboard a11y
                      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                      <div
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onKeyDown={onKeyDown}
                        ref={ref}
                        style={{
                          ...style,
                          ...defaultTransitionStyles,
                          ...transitionStyles[transitionState],
                        }}
                        data-placement={placement}
                        className={`${wrapperClassName}`}
                      >
                        <div className={className}>
                          {typeof content === 'string' && content}
                          {React.isValidElement(content) && React.cloneElement(content)}
                          {typeof content === 'function' &&
                            content({
                              updatePopperPosition: update,
                            })}
                          {renderArrow &&
                            renderArrow({
                              arrowProps,
                              placement,
                            })}
                        </div>
                      </div>
                    );
                  }}
                </ReactPopper>
              </Portal>
            );
          }}
        </Transition>
      </Manager>
    );
  }
}

export { Popover };
