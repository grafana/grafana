import React, { createRef } from 'react';
import * as PopperJS from 'popper.js';
import Popper from './Popper';
import PopperController, { UsingPopperProps } from './PopperController';

export enum Themes {
  Default = 'popper__background--default',
  Error = 'popper__background--error',
  Brand = 'popper__background--brand',
}

interface TooltipProps extends UsingPopperProps {
  theme?: Themes;
}
export const Tooltip = ({ children, renderContent, theme, ...controllerProps }: TooltipProps) => {
  const tooltipTriggerRef = createRef<PopperJS.ReferenceObject>();
  const popperBackgroundClassName = 'popper__background' + (theme ? ' ' + theme : '');

  return (
    <PopperController {...controllerProps}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {tooltipTriggerRef.current && (
              <Popper
                {...popperProps}
                onMouseEnter={showPopper}
                onMouseLeave={hidePopper}
                referenceElement={tooltipTriggerRef.current}
                className={popperBackgroundClassName}
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
