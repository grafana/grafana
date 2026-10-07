import { css, cx } from '@emotion/css';
import { FloatingFocusManager, useFloating } from '@floating-ui/react';
import RcDrawer from '@rc-component/drawer';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { getDragStyles } from '../DragHandle/DragHandle';
import { Stack } from '../Layout/Stack/Stack';
import { getPortalContainer } from '../Portal/Portal';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';
import { Text } from '../Text/Text';

import { DRAWER_COMPANION_ATTRIBUTE, DRAWER_CONTAINER_SELECTOR, DRAWER_OFFSET_RIGHT_VAR } from './drawerRegion';

export interface Props {
  children: ReactNode;
  /** Title shown at the top of the drawer */
  title?: ReactNode;
  /** Subtitle shown below the title */
  subtitle?: ReactNode;
  /** Should the Drawer be closable by clicking on the mask, defaults to true */
  closeOnMaskClick?: boolean;
  /** @deprecated */
  inline?: boolean;
  /**
   * @deprecated use the size property instead
   **/
  width?: number | string;
  /**
   * @deprecated use a large size instead if high width is needed
   **/
  expandable?: boolean;
  /**
   * Specifies the width and min-width, relative to the area the drawer can cover.
   * sm = width 25% & min-width 384px
   * md = width 50% & min-width 568px
   * lg = width 75% & min-width 744px
   **/
  size?: 'sm' | 'md' | 'lg';
  /** Tabs */
  tabs?: React.ReactNode;
  /**
   * Whether the content should be wrapped in a ScrollContainer
   * Only change this if you intend to manage scroll behaviour yourself
   * (e.g. having a split pane with independent scrolling)
   **/
  scrollableContent?: boolean;
  /** Callback for closing the drawer */
  onClose: () => void;
}

const drawerSizes = {
  sm: { width: '25%', minWidth: 384 },
  md: { width: '50%', minWidth: 568 },
  lg: { width: '75%', minWidth: 744 },
};

/**
 * Drawer is a slide in overlay that can be used to display additional information without hiding the main page content. It can be anchored to the left or right edge of the screen.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/overlays-drawer--docs
 */
export function Drawer({
  children,
  onClose,
  closeOnMaskClick = true,
  scrollableContent = true,
  title,
  subtitle,
  width,
  size = 'md',
  tabs,
}: Props) {
  const [drawerWidth, onMouseDown, onTouchStart] = useResizebleDrawer();

  const styles = useStyles2(getStyles);
  const wrapperStyles = useStyles2(getWrapperStyles, size);
  const dragStyles = useStyles2(getDragStyles);
  const titleId = useId();

  const { context, refs } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose?.();
      }
    },
  });

  // Adds body class while open so the toolbar nav can hide some actions while drawer is open
  useBodyClassWhileOpen();

  const content = <div className={styles.content}>{children}</div>;
  const overrideWidth = drawerWidth ?? width ?? drawerSizes[size].width;
  // Never wider than the drawer region, which can be narrower than the min-width (e.g. next to a docked sidebar)
  const minWidth = `min(${drawerSizes[size].minWidth}px, 100%)`;

  return (
    <RcDrawer
      open={true}
      onClose={onClose}
      placement="right"
      getContainer={DRAWER_CONTAINER_SELECTOR}
      className={styles.drawerContent}
      rootClassName={styles.drawer}
      classNames={{
        wrapper: wrapperStyles,
      }}
      styles={{
        wrapper: {
          width: overrideWidth,
          minWidth,
        },
      }}
      aria-label={typeof title === 'string' ? selectors.components.Drawer.General.title(title) : undefined}
      aria-labelledby={title ? titleId : undefined}
      width={''}
      motion={{
        motionAppear: true,
        motionName: styles.drawerMotion,
      }}
      maskClassName={styles.mask}
      maskClosable={closeOnMaskClick}
      maskMotion={{
        motionAppear: true,
        motionName: styles.maskMotion,
      }}
      // this is handled by floating-ui
      autoFocus={false}
    >
      <FloatingFocusManager context={context} modal getInsideElements={getInsideElements}>
        <div className={styles.container} ref={refs.setFloating}>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className={cx(dragStyles.dragHandleVertical, styles.resizer)}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          />
          <div className={cx(styles.header, Boolean(tabs) && styles.headerWithTabs)}>
            <div className={styles.actions}>
              <Button
                icon="times"
                size="sm"
                variant="secondary"
                onClick={onClose}
                data-testid={selectors.components.Drawer.General.close}
                tooltip={t(`grafana-ui.drawer.close`, 'Close')}
              />
            </div>
            {typeof title === 'string' ? (
              <Stack direction="column">
                <Text element="h3" id={titleId} truncate>
                  {title}
                </Text>
                {subtitle && (
                  <div className={styles.subtitle} data-testid={selectors.components.Drawer.General.subtitle}>
                    {subtitle}
                  </div>
                )}
              </Stack>
            ) : (
              <div id={titleId}>{title}</div>
            )}
            {tabs && <div className={styles.tabsWrapper}>{tabs}</div>}
          </div>
          {!scrollableContent ? (
            content
          ) : (
            <div className={styles.scrollWrapper}>
              <ScrollContainer borderRadius="lg" showScrollIndicators>
                {content}
              </ScrollContainer>
            </div>
          )}
        </div>
      </FloatingFocusManager>
    </RcDrawer>
  );
}

function useResizebleDrawer(): [
  string | undefined,
  React.EventHandler<React.MouseEvent>,
  React.EventHandler<React.TouchEvent>,
] {
  const [drawerWidth, setDrawerWidth] = useState<string | undefined>(undefined);
  const visualDesignRefresh = useTheme2().flags.visualDesignRefresh;
  // The drawer region is measured when a drag starts, so the width follows the area the drawer
  // can cover rather than the whole body (they differ next to a docked sidebar or in a workspace).
  const regionRef = useRef<DOMRect | undefined>(undefined);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      setDrawerWidth(getCustomDrawerWidth(e.clientX, regionRef.current, visualDesignRefresh));
    },
    [visualDesignRefresh]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      setDrawerWidth(getCustomDrawerWidth(touch.clientX, regionRef.current, visualDesignRefresh));
    },
    [visualDesignRefresh]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    },
    [onMouseMove]
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    },
    [onTouchMove]
  );

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    regionRef.current = getDrawerRegion(e.currentTarget);
    // we will only add listeners when needed, and remove them afterward
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    regionRef.current = getDrawerRegion(e.currentTarget);
    // we will only add listeners when needed, and remove them afterward
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }

  return [drawerWidth, onMouseDown, onTouchStart];
}

function getInsideElements(): Element[] {
  return [getPortalContainer(), ...document.querySelectorAll(`[${DRAWER_COMPANION_ATTRIBUTE}]`)];
}

/** The box the drawer is laid out in: the rc-drawer root, which fills the drawer region. */
function getDrawerRegion(resizer: HTMLElement): DOMRect {
  return (resizer.closest('.rc-drawer') ?? document.body).getBoundingClientRect();
}

function getCustomDrawerWidth(clientX: number, region: DOMRect | undefined, visualRefreshEnabled?: boolean): string {
  const { right, width } = region ?? document.body.getBoundingClientRect();
  const offsetRight = right - clientX - (visualRefreshEnabled ? 8 : 0);
  const widthPercent = Math.min((offsetRight / width) * 100, 98).toFixed(2);
  return `${widthPercent}%`;
}

function useBodyClassWhileOpen() {
  useEffect(() => {
    if (!document.body) {
      return;
    }

    document.body.classList.add('body-drawer-open');

    return () => {
      document.body.classList.remove('body-drawer-open');
    };
  }, []);
}

const getStyles = (theme: GrafanaTheme2) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: '1 1 0',
      minHeight: '100%',
      position: 'relative',
    }),
    drawer: css({
      inset: 0,
      right: `var(${DRAWER_OFFSET_RIGHT_VAR}, 0px)`,
      position: 'fixed',
      zIndex: theme.zIndex.modalBackdrop,
      pointerEvents: 'none',

      '.rc-drawer-content-wrapper': {
        boxShadow: theme.shadows.z3,
      },
    }),
    scrollWrapper: css(
      {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        maxHeight: '100%',
        minHeight: 0,
        minWidth: 0,
      },
      visualRefreshEnabled && {
        borderBottomLeftRadius: theme.shape.radius.lg,
        borderBottomRightRadius: theme.shape.radius.lg,
        overflow: 'hidden',
      }
    ),
    drawerContent: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      pointerEvents: 'auto',
      width: '100%',
    }),
    drawerMotion: css({
      '&-appear': {
        [theme.transitions.handleMotion('no-preference')]: {
          transform: visualRefreshEnabled ? `translateX(calc(100% + ${theme.spacing(1)}))` : 'translateX(100%)',
          transition: 'none',
        },
        [theme.transitions.handleMotion('reduce')]: {
          opacity: 0,
        },
        '&-active': {
          [theme.transitions.handleMotion('no-preference')]: {
            transform: 'translateX(0)',
            transition: theme.transitions.create('transform'),
          },
          [theme.transitions.handleMotion('reduce')]: {
            transition: `opacity 0.2s ease-in-out`,
            opacity: 1,
          },
        },
      },
    }),
    // we want the mask itself to span the whole page including the top bar
    // this ensures trying to click something in the top bar will close the drawer correctly
    // but we don't want the backdrop styling to apply over the top bar as it looks weird
    // instead have a child pseudo element to apply the backdrop styling below the top bar
    mask: css({
      inset: 0,
      right: `var(${DRAWER_OFFSET_RIGHT_VAR}, 0px)`,
      pointerEvents: 'auto',
      position: 'fixed',
      zIndex: theme.zIndex.modalBackdrop,

      '&:before': {
        backgroundColor: theme.components.overlay.background,
        bottom: 0,
        content: '""',
        left: 0,
        position: 'fixed',
        right: `var(${DRAWER_OFFSET_RIGHT_VAR}, 0px)`,
        top: 0,
      },
    }),
    maskMotion: css({
      '&-appear': {
        opacity: 0,

        '&-active': {
          opacity: 1,
          [theme.transitions.handleMotion('no-preference', 'reduce')]: {
            transition: theme.transitions.create('opacity'),
          },
        },
      },
    }),
    header: css({
      label: 'drawer-header',
      flexGrow: 0,
      padding: theme.spacing(2, 2, 3),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerWithTabs: css({
      borderBottom: 'none',
    }),
    actions: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(1),
    }),
    subtitle: css({
      label: 'drawer-subtitle',
      color: theme.colors.text.secondary,
    }),
    content: css({
      padding: theme.spacing(theme.components.drawer?.padding ?? 2),
      height: '100%',
      flexGrow: 1,
      minHeight: 0,
    }),
    tabsWrapper: css({
      label: 'drawer-tabs',
      paddingLeft: theme.spacing(2),
      margin: theme.spacing(1, -1, -3, -3),
    }),
    resizer: css({
      top: 0,
      left: theme.spacing(-0.5),
      bottom: 0,
      position: 'absolute',
      zIndex: theme.zIndex.modal,
    }),
  };
};

function getWrapperStyles(theme: GrafanaTheme2, size: 'sm' | 'md' | 'lg') {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  return css(
    {
      backgroundColor: theme.components.drawer.background,
      border: `1px solid ${theme.components.drawer.borderColor}`,
      bottom: 0,
      label: `drawer-content-wrapper-${size}`,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: theme.zIndex.modalBackdrop,

      [theme.breakpoints.down('md')]: {
        width: `calc(100% - ${theme.spacing(2)}) !important`,
        minWidth: '0 !important',
      },
    },
    visualRefreshEnabled && {
      borderRadius: theme.shape.radius.lg,
      bottom: theme.spacing(1),
      right: theme.spacing(1),
      top: theme.spacing(1),
    }
  );
}
