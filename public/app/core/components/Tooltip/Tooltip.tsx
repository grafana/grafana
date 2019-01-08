import React, { createRef } from 'react';
import * as PopperJS from 'popper.js';

import Popper from './Popper';
import PopperController, { UsingPopperProps } from './PopperController';

const Tooltip = ({ children, renderContent, ...controllerProps }: UsingPopperProps) => {
  const tooltipTriggerRef = createRef<PopperJS.ReferenceObject>();

  return (
    <PopperController {...controllerProps}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            <Popper
              {...popperProps}
              onMouseEnter={showPopper}
              onMouseLeave={hidePopper}
              referenceElement={tooltipTriggerRef.current}
            />
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

export default Tooltip;
