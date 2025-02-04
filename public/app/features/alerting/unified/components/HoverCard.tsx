import { css } from '@emotion/css';
import { Placement } from '@popperjs/core';
import classnames from 'classnames';
import { ReactElement, ReactNode, cloneElement, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Popover as GrafanaPopover, PopoverController, Stack, useStyles2 } from '@grafana/ui';

export interface PopupCardProps {
  children: ReactElement;
  header?: ReactNode;
  content: ReactElement;
  footer?: ReactNode;
  wrapperClassName?: string;
  placement?: Placement;
  disabled?: boolean;
  showAfter?: number;
  arrow?: boolean;
  showOn?: 'click' | 'hover';
}

export const PopupCard = ({
  children,
  header,
  content,
  footer,
  arrow,
  showAfter = 300,
  wrapperClassName,
  disabled = false,
  showOn = 'hover',
  ...rest
}: PopupCardProps) => {
  const popoverRef = useRef<HTMLElement>(null);
  const styles = useStyles2(getStyles);

  if (disabled) {
    return children;
  }

  const showOnHover = showOn === 'hover';
  const showOnClick = showOn === 'click';

  const body = (
    <Stack direction="column" gap={0} role="tooltip">
      {header && <div className={styles.card.header}>{header}</div>}
      <div className={styles.card.body}>{content}</div>
      {footer && <div className={styles.card.footer}>{footer}</div>}
    </Stack>
  );

  return (
    <PopoverController content={body} hideAfter={100}>
      {(showPopper, hidePopper, popperProps) => {
        // support hover and click interaction
        const onClickProps = {
          onClick: showPopper,
        };

        const onHoverProps = {
          onMouseLeave: hidePopper,
          onMouseEnter: showPopper,
        };

        const blurFocusProps = {
          onBlur: hidePopper,
          onFocus: showPopper,
        };

        return (
          <>
            {popoverRef.current && (
              <GrafanaPopover
                {...popperProps}
                {...rest}
                wrapperClassName={classnames(styles.popover, wrapperClassName)}
                referenceElement={popoverRef.current}
                renderArrow={arrow}
                // @TODO
                // if we want interaction with the content we should not pass blur / focus handlers but then clicking outside doesn't close the popper
                {...blurFocusProps}
                // if we want hover interaction we have to make sure we add the leave / enter handlers
                {...(showOnHover ? onHoverProps : {})}
              />
            )}

            {cloneElement(children, {
              ref: popoverRef,
              onFocus: showPopper,
              onBlur: hidePopper,
              tabIndex: 0,
              // make sure we pass the correct interaction handlers here to the element we want to interact with
              ...(showOnHover ? onHoverProps : {}),
              ...(showOnClick ? onClickProps : {}),
            })}
          </>
        );
      }}
    </PopoverController>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  card: {
    body: css({
      padding: theme.spacing(1),
    }),
    header: css({
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderBottom: `solid 1px ${theme.colors.border.medium}`,
    }),
    footer: css({
      padding: theme.spacing(0.5, 1),
      background: theme.colors.background.secondary,
      borderTop: `solid 1px ${theme.colors.border.medium}`,
    }),
  },
});
