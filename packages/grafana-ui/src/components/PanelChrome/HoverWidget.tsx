import { css, cx } from '@emotion/css';
import { ReactElement, useCallback, useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

import { PanelMenu } from './PanelMenu';

interface Props {
  children?: React.ReactNode;
  menu?: ReactElement | (() => ReactElement);
  title?: string;
  offset?: number;
  dragClass?: string;
  onOpenMenu?: () => void;
}

export function HoverWidget({ menu, title, dragClass, children, offset = -32, onOpenMenu }: Props) {
  const styles = useStyles2(getStyles);
  const draggableRef = useRef<HTMLDivElement>(null);
  const selectors = e2eSelectors.components.Panels.Panel.HoverWidget;
  // Capture the pointer to keep the widget visible while dragging
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggableRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggableRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  if (children === undefined || React.Children.count(children) === 0) {
    return null;
  }

  return (
    <div className={cx(styles.container, 'show-on-hover')} style={{ top: offset }} data-testid={selectors.container}>
      {dragClass && (
        <div
          className={cx(styles.square, styles.draggable, dragClass)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          ref={draggableRef}
          data-testid={selectors.dragIcon}
        >
          <Icon name="expand-arrows" className={styles.draggableIcon} />
        </div>
      )}
      {children}
      {menu && (
        <PanelMenu
          menu={menu}
          title={title}
          placement="bottom"
          menuButtonClass={styles.menuButton}
          onOpenMenu={onOpenMenu}
        />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      label: 'hover-container-widget',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: `all .1s linear`,
      },
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
    draggableIcon: css({
      transform: 'rotate(45deg)',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}
