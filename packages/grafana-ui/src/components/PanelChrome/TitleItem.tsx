import { cx, css } from '@emotion/css';
import React, { forwardRef } from 'react';

import { GrafanaTheme2, LinkModel, LinkTarget } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Button } from '../Button';

type TitleItemProps = {
  className?: string;
  children: React.ReactNode;
  onClick?: LinkModel['onClick'];
  href?: string;
  target?: LinkTarget;
  title?: string;
};

type TitleItemElement = HTMLAnchorElement & HTMLButtonElement;

export const TitleItem = forwardRef<TitleItemElement, TitleItemProps>(
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
          className={cx(styles.linkItem, className)}
          {...rest}
        >
          {children}
        </a>
      );
    } else if (onClick) {
      return (
        <Button ref={ref} className={cx(styles.item, className)} variant="secondary" fill="text" onClick={onClick}>
          {children}
        </Button>
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
  const item = css({
    color: `${theme.colors.text.secondary}`,
    label: 'panel-header-item',
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
      color: `${theme.colors.text.primary}`,
    },
  });

  return {
    item,
    linkItem: cx(item, css({ cursor: 'pointer' })),
  };
};
