import { css, cx } from '@emotion/css';
import { type ReactElement, useCallback, useRef } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

import { HoverSlotItemsContext } from './PanelChromeHeaderControlsContext';
import { PanelMenu } from './PanelMenu';

interface Props {
  children?: React.ReactNode;
  menu?: ReactElement | (() => ReactElement);
  title?: string;
  offset?: number;
  dragClass?: string;
  onDragStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onOpenMenu?: () => void;
  /** Renders the contents without the floating container, for embedding in another element. */
  inline?: boolean;
}

export function HoverWidget({
  menu,
  title,
  dragClass,
  children,
  offset = -32,
  onOpenMenu,
  onDragStart,
  inline = false,
}: Props) {
  const styles = useStyles2(getStyles);
  const selectors = e2eSelectors.components.Panels.Panel.HoverWidget;

  if (children === undefined || React.Children.count(children) === 0) {
    return null;
  }

  return (
    <div
      className={inline ? styles.inlineContainer : cx(styles.container, 'show-on-hover')}
      style={inline ? undefined : { top: offset === 0 ? -1 : offset }}
      data-testid={selectors.container}
    >
      {dragClass && <HoverWidgetDragHandle dragClass={dragClass} onDragStart={onDragStart} inline={inline} />}
      {inline ? <HoverSlotItemsContext.Provider value={true}>{children}</HoverSlotItemsContext.Provider> : children}
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

interface DragHandleProps {
  dragClass: string;
  onDragStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
  inline?: boolean;
}

/**
 * The handle that drags the panel, also rendered on its own when an external host places it apart from the other
 * hover widget contents.
 */
export function HoverWidgetDragHandle({ dragClass, onDragStart, inline = false }: DragHandleProps) {
  const styles = useStyles2(getStyles);
  const draggableRef = useRef<HTMLDivElement>(null);

  // Capture the pointer to keep the widget visible while dragging
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggableRef.current?.setPointerCapture(e.pointerId);
      onDragStart?.(e);
    },
    [onDragStart]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggableRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      className={cx(inline ? styles.inlineSquare : styles.square, styles.draggable, dragClass)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      ref={draggableRef}
      data-testid={e2eSelectors.components.Panels.Panel.HoverWidget.dragIcon}
    >
      <Icon name="expand-arrows" className={inline ? styles.inlineDraggableIcon : styles.draggableIcon} />
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
      right: -1,
      top: -1,
      boxSizing: 'content-box',
      alignItems: 'center',
      background: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderBottomLeftRadius: theme.shape.radius.default,
      height: theme.spacing(4),
      boxShadow: theme.shadows.z1,
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1),
    }),
    inlineContainer: css({
      label: 'hover-container-widget-inline',
      // The items join the host element's flex layout and spacing; wrappers that render nothing leave no gap.
      display: 'contents',
      color: theme.colors.text.primary,
    }),
    inlineSquare: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: theme.spacing(2),
      height: theme.spacing(2),
    }),
    inlineDraggableIcon: css({
      // Rotated, the corner-pointing arrows reach √2 further than the box edge; scaling by 1/√2 makes them span
      // as much as the neighbouring 16px icons.
      transform: 'rotate(45deg) scale(0.7071)',
      color: theme.colors.text.primary,
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
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
