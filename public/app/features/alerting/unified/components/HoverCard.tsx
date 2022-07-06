import { css } from '@emotion/css';
import { Placement } from '@popperjs/core';
import classnames from 'classnames';
import React, { FC, ReactElement, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Popover as GrafanaPopover, PopoverController, useStyles2 } from '@grafana/ui';

export interface HoverCardProps {
  children: ReactElement;
  content: ReactElement;
  wrapperClassName?: string;
  placement?: Placement;
  disabled?: boolean;
}

export const HoverCard: FC<HoverCardProps> = ({ children, content, wrapperClassName, disabled = false, ...rest }) => {
  const popoverRef = useRef<HTMLElement>(null);
  const styles = useStyles2(getStyles);

  if (disabled) {
    return children;
  }

  return (
    <PopoverController content={content} hideAfter={100}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {popoverRef.current && (
              <GrafanaPopover
                {...popperProps}
                {...rest}
                wrapperClassName={classnames(styles.popover, wrapperClassName)}
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

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css`
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};

    padding: ${theme.spacing(1)};
  `,
});
