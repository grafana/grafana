import React, { useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { GrafanaThemeV2 } from '@grafana/data';
import { usePopper } from 'react-popper';
import { Placement } from '@popperjs/core';

export interface Props {
  children: React.ReactNode;
  anchorEl: HTMLElement | null;
  placement?: Placement;
}

/**
 * @internal
 */
export const Popper = React.memo(<T,>({ children, anchorEl, placement = 'bottom' }: Props) => {
  const styles = useStyles2(getStyles);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);

  const { styles: popperStyles, attributes } = usePopper(anchorEl, popperElement, {
    placement: placement,
    modifiers: [
      // {
      //   name: 'flip',
      //   enabled: true,
      // },
      {
        name: 'preventOverflow',
        enabled: true,
      },
    ],
  });

  return (
    <div ref={setPopperElement} className={styles.wrapper} style={popperStyles.popper} {...attributes}>
      {children}
    </div>
  );
});

Popper.displayName = 'Popper';

const getStyles = (theme: GrafanaThemeV2) => {
  return {
    wrapper: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
    `,
  };
};
