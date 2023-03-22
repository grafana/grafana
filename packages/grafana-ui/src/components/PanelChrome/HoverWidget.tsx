import { css, cx } from '@emotion/css';
import React, { ReactElement, useCallback, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

import { PanelMenu } from './PanelMenu';

interface Props {
  children?: React.ReactNode;
  menu: ReactElement | (() => ReactElement);
  title?: string;
  offset?: number;
  dragClass?: string;
}

export function HoverWidget({ menu, title, dragClass, children, offset = -32 }: Props) {
  const styles = useStyles2(getStyles);
  const draggableRef = useRef<HTMLDivElement>(null);

  // Capture the pointer to keep the widget visible while dragging
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggableRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggableRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);

  if (children === undefined || React.Children.count(children) === 0) {
    return null;
  }

  return (
    <div
      className={cx(styles.container, { 'show-on-hover': !menuOpen })}
      style={{ top: `${offset}px` }}
      data-testid="hover-header-container"
    >
      <div
        className={cx(styles.square, styles.draggable, dragClass)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        ref={draggableRef}
      >
        <Icon name="expand-arrows" className={styles.draggableIcon} />
      </div>
      {!title && <h6 className={cx(styles.untitled, styles.draggable, dragClass)}>Untitled</h6>}
      {children}
      <div className={styles.square}>
        <PanelMenu
          menu={menu}
          title={title}
          placement="bottom"
          menuButtonClass={styles.menuButton}
          onVisibleChange={setMenuOpen}
        />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    hidden: css({
      visibility: 'hidden',
      opacity: '0',
    }),
    container: css({
      label: 'hover-container-widget',
      transition: `all .1s linear`,
      display: 'flex',
      position: 'absolute',
      zIndex: 1,
      right: 0,
      boxSizing: 'content-box',
      alignItems: 'center',
      background: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      height: theme.spacing(4),
      boxShadow: theme.shadows.z1,
    }),
    square: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: theme.spacing(4),
      height: '100%',
      paddingRight: theme.spacing(0.5),
    }),
    draggable: css({
      cursor: 'move',
      // mobile do not support draggable panels
      [theme.breakpoints.down('md')]: {
        display: 'none',
      },
    }),
    menuButton: css({
      // Background and border are overriden when topnav toggle is disabled
      background: 'inherit',
      border: 'none',
      '&:hover': {
        background: theme.colors.secondary.main,
      },
    }),
    title: css({
      padding: theme.spacing(0.75),
    }),
    untitled: css({
      color: theme.colors.text.disabled,
      fontStyle: 'italic',
      marginBottom: 0,
    }),
    draggableIcon: css({
      transform: 'rotate(45deg)',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}
