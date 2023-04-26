import { css } from '@emotion/css';
import { Placement } from '@popperjs/core';
import classnames from 'classnames';
import React, { ReactElement, ReactNode, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Popover as GrafanaPopover, PopoverController, useStyles2 } from '@grafana/ui';

export interface HoverCardProps {
  children: ReactElement;
  header?: ReactNode;
  content: ReactElement;
  footer?: ReactNode;
  wrapperClassName?: string;
  placement?: Placement;
  disabled?: boolean;
  showAfter?: number;
  arrow?: boolean;
}

export const HoverCard = ({
  children,
  header,
  content,
  footer,
  arrow,
  showAfter = 300,
  wrapperClassName,
  disabled = false,
  ...rest
}: HoverCardProps) => {
  const popoverRef = useRef<HTMLElement>(null);
  const styles = useStyles2(getStyles);

  if (disabled) {
    return children;
  }

  const body = (
    <Stack direction="column" gap={0}>
      {header && <div className={styles.card.header}>{header}</div>}
      <div className={styles.card.body}>{content}</div>
      {footer && <div className={styles.card.footer}>{footer}</div>}
    </Stack>
  );

  return (
    <PopoverController content={body} hideAfter={100}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {popoverRef.current && (
              <GrafanaPopover
                {...popperProps}
                {...rest}
                wrapperClassName={classnames(styles.popover(arrow ? 1.25 : 0), wrapperClassName)}
                onMouseLeave={hidePopper}
                onMouseEnter={showPopper}
                referenceElement={popoverRef.current}
                renderArrow={
                  arrow
                    ? ({ arrowProps, placement }) => <div className={styles.arrow(placement)} {...arrowProps} />
                    : () => <></>
                }
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
  popover: (offset: number) => css`
    border-radius: ${theme.shape.borderRadius()};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};

    margin-bottom: ${theme.spacing(offset)};
  `,
  card: {
    body: css`
      padding: ${theme.spacing(1)};
    `,
    header: css`
      padding: ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-bottom: solid 1px ${theme.colors.border.medium};
    `,
    footer: css`
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-top: solid 1px ${theme.colors.border.medium};
    `,
  },
  // TODO currently only works with bottom placement
  arrow: (placement: string) => {
    const ARROW_SIZE = '9px';

    return css`
      width: 0;
      height: 0;

      border-left: ${ARROW_SIZE} solid transparent;
      border-right: ${ARROW_SIZE} solid transparent;
      /* using hex colors here because the border colors use alpha transparency */
      border-top: ${ARROW_SIZE} solid ${theme.isLight ? '#d2d3d4' : '#2d3037'};

      &:after {
        content: '';
        position: absolute;

        border: ${ARROW_SIZE} solid ${theme.colors.background.primary};
        border-bottom: 0;
        border-left-color: transparent;
        border-right-color: transparent;

        margin-top: 1px;
        bottom: 1px;
        left: -${ARROW_SIZE};
      }
    `;
  },
});
