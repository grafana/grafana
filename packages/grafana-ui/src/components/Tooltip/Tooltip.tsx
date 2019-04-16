import React, { createRef } from 'react';
import * as PopperJS from 'popper.js';
import { Popper } from './Popper';
import { PopperController, UsingPopperProps } from './PopperController';

interface TooltipProps extends UsingPopperProps {
  theme?: 'info' | 'error';
}
export const Tooltip = ({ children, theme, ...controllerProps }: TooltipProps) => {
  const tooltipTriggerRef = createRef<PopperJS.ReferenceObject>();
  const popperBackgroundClassName = 'popper__background' + (theme ? ' popper__background--' + theme : '');

  return (
    <PopperController {...controllerProps}>
      {(showPopper, hidePopper, popperProps) => {
        {
          /* Override internal 'show' state if passed in as prop */
        }
        const payloadProps = {
          ...popperProps,
          show: controllerProps.show !== undefined ? controllerProps.show : popperProps.show,
        };
        return (
          <>
            {tooltipTriggerRef.current && (
              <Popper
                {...payloadProps}
                onMouseEnter={showPopper}
                onMouseLeave={hidePopper}
                referenceElement={tooltipTriggerRef.current}
                wrapperClassName="popper"
                className={popperBackgroundClassName}
                renderArrow={({ arrowProps, placement }) => (
                  <div className="popper__arrow" data-placement={placement} {...arrowProps} />
                )}
              />
            )}
            {React.cloneElement(children, {
              ref: tooltipTriggerRef,
              onMouseEnter: showPopper,
              onMouseLeave: hidePopper,
            })}
          </>
        );
      }}
    </PopperController>
  );
};
