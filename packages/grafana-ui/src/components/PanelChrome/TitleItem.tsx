import { cx, css } from '@emotion/css';
import React, { forwardRef } from 'react';

import { GrafanaTheme2, LinkModel, LinkTarget } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

type TitleItemProps = {
  className?: string;
  children: React.ReactNode;
  onClick?: LinkModel['onClick'];
  href?: string;
  target?: LinkTarget;
  title?: string;
};

export const TitleItem = forwardRef<HTMLAnchorElement, TitleItemProps>(
  ({ className, children, href, onClick, target, title, ...rest }, ref) => {
    const styles = useStyles2(getStyles);

    if (href) {
      return (
        <a
          ref={ref}
          href={href}
          onClick={onClick}
          target={target}
          title={title}
          className={cx(styles.item, className)}
          {...rest}
        >
          {children}
        </a>
      );
    } else {
      return (
        <span ref={ref} className={cx(styles.item, className)} {...rest}>
          {children}
        </span>
      );
    }
  }
);

TitleItem.displayName = 'TitleItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css({
      color: `${theme.colors.text.secondary}`,
      label: 'panel-header-item',
      cursor: 'auto',
      border: 'none',
      borderRadius: `${theme.shape.borderRadius()}`,
      padding: `${theme.spacing(0, 1)}`,
      height: `${theme.spacing(theme.components.panel.headerHeight)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },
      '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&:hover ': {
        boxShadow: `${theme.shadows.z1}`,
        background: `${theme.colors.background.secondary}`,
      },
    }),
  };
};
