import { css } from '@emotion/css';
import classnames from 'classnames';
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
      className={classnames(styles.container, { 'show-on-hover': !menuOpen })}
      style={{ top: `${offset}px` }}
      data-testid="hover-header-container"
    >
      <div
        className={classnames(styles.square, styles.draggable, dragClass)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        ref={draggableRef}
      >
        <Icon name="draggabledots" />
      </div>
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
      boxSizing: 'border-box',
      alignItems: 'center',
      background: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: '1px',
      height: theme.spacing(4),
      boxShadow: theme.shadows.z1,
    }),
    square: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: theme.spacing(4),
      height: '100%',
    }),
    draggable: css({
      cursor: 'move',
    }),
    menuButton: css({
      color: theme.colors.text.primary,
      '&:hover': {
        background: 'inherit',
      },
    }),
    title: css({
      padding: theme.spacing(0.75),
    }),
  };
}
