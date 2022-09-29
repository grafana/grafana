import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Link, useTheme2 } from '@grafana/ui';

import { NavFeatureHighlight } from './NavFeatureHighlight';

export interface NavBarItemWithoutMenuProps {
  label: string;
  children: ReactNode;
  className?: string;
  elClassName?: string;
  url?: string;
  target?: string;
  isActive?: boolean;
  onClick?: () => void;
  highlightText?: string;
}

export function NavBarItemWithoutMenu({
  label,
  children,
  url,
  target,
  isActive = false,
  onClick,
  highlightText,
  className,
  elClassName,
}: NavBarItemWithoutMenuProps) {
  const theme = useTheme2();
  const styles = getNavBarItemWithoutMenuStyles(theme, isActive);

  const content = highlightText ? (
    <NavFeatureHighlight>
      <div className={styles.icon}>{children}</div>
    </NavFeatureHighlight>
  ) : (
    <div className={styles.icon}>{children}</div>
  );

  const elStyle = cx(styles.element, elClassName);

  const renderContents = () => {
    if (!url) {
      return (
        <button className={elStyle} onClick={onClick} aria-label={label}>
          {content}
        </button>
      );
    } else if (!target && url.startsWith('/')) {
      return (
        <Link className={elStyle} href={url} target={target} aria-label={label} onClick={onClick} aria-haspopup="true">
          {content}
        </Link>
      );
    } else {
      return (
        <a href={url} target={target} className={elStyle} onClick={onClick} aria-label={label}>
          {content}
        </a>
      );
    }
  };

  return <div className={cx(styles.container, className)}>{renderContents()}</div>;
}

export function getNavBarItemWithoutMenuStyles(theme: GrafanaTheme2, isActive?: boolean) {
  return {
    container: css({
      position: 'relative',
      color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
      display: 'grid',

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    element: css({
      backgroundColor: 'transparent',
      border: 'none',
      color: 'inherit',
      display: 'block',
      padding: 0,
      overflowWrap: 'anywhere',

      '&::before': {
        display: isActive ? 'block' : 'none',
        content: "' '",
        position: 'absolute',
        left: theme.spacing(1),
        top: theme.spacing(1.5),
        bottom: theme.spacing(1.5),
        width: theme.spacing(0.5),
        borderRadius: theme.shape.borderRadius(1),
        backgroundImage: theme.colors.gradients.brandVertical,
      },

      '&:focus-visible': {
        backgroundColor: theme.colors.action.hover,
        boxShadow: 'none',
        color: theme.colors.text.primary,
        outline: `${theme.shape.borderRadius(1)} solid ${theme.colors.primary.main}`,
        outlineOffset: `-${theme.shape.borderRadius(1)}`,
        transition: 'none',
      },
    }),

    icon: css({
      height: '100%',
      width: '100%',
    }),
  };
}
