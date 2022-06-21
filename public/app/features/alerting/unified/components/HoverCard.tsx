import { Placement } from '@popperjs/core';
import React, { FC, ReactElement, useRef } from 'react';

import { Popover as GrafanaPopover, PopoverController } from '@grafana/ui';

export interface HoverCardProps {
  children: ReactElement;
  content: ReactElement;
  wrapperClassName?: string;
  placement?: Placement;
}

export const HoverCard: FC<HoverCardProps> = ({ children, content, wrapperClassName, ...rest }) => {
  const popoverRef = useRef<HTMLElement>(null);

  return (
    <PopoverController content={content} hideAfter={300}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {popoverRef.current && (
              <GrafanaPopover
                {...popperProps}
                {...rest}
                wrapperClassName={wrapperClassName}
                onMouseLeave={hidePopper}
                onMouseEnter={showPopper}
                referenceElement={popoverRef.current}
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
};
