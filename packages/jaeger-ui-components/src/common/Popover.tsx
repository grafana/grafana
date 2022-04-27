import React, { ReactElement, useRef } from 'react';

import { Popover as GrafanaPopover, PopoverController } from '@grafana/ui';

export type PopoverProps = {
  children: ReactElement;
  content: ReactElement;
  overlayClassName?: string;
};

export function Popover({ children, content, overlayClassName }: PopoverProps) {
  const popoverRef = useRef<HTMLElement>(null);

  return (
    <PopoverController content={content} hideAfter={300}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {popoverRef.current && (
              <GrafanaPopover
                {...popperProps}
                referenceElement={popoverRef.current}
                wrapperClassName={overlayClassName}
                onMouseLeave={hidePopper}
                onMouseEnter={showPopper}
              />
            )}

            {React.cloneElement(children, {
              ref: popoverRef,
              onMouseEnter: showPopper,
              onMouseLeave: hidePopper,
            })}
          </>
        );
      }}
    </PopoverController>
  );
}
