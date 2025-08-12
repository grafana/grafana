import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import RcDrawer from 'rc-drawer';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { getDragStyles } from '../DragHandle/DragHandle';
import { IconButton } from '../IconButton/IconButton';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';
import { Text } from '../Text/Text';

import 'rc-drawer/assets/index.css';
import { Stack } from '../Layout/Stack/Stack';

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
   * Specifies the width and min-width.
   * sm = width 25vw & min-width 384px
   * md = width 50vw & min-width 568px
   * lg = width 75vw & min-width 744px
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
  sm: { width: '25vw', minWidth: 384 },
  md: { width: '50vw', minWidth: 568 },
  lg: { width: '75vw', minWidth: 744 },
};

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

  const overlayRef = React.useRef(null);
  const { dialogProps, titleProps } = useDialog({}, overlayRef);
  const { overlayProps } = useOverlay(
    {
      isDismissable: false,
      isOpen: true,
      onClose,
    },
    overlayRef
  );

  // Adds body class while open so the toolbar nav can hide some actions while drawer is open
  useBodyClassWhileOpen();

  const content = <div className={styles.content}>{children}</div>;
  const overrideWidth = drawerWidth ?? width ?? drawerSizes[size].width;
  const minWidth = drawerSizes[size].minWidth;

  return (
    <RcDrawer
      open={true}
      onClose={onClose}
      placement="right"
      getContainer={'.main-view'}
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
    >
      <FocusScope restoreFocus contain autoFocus>
        <div
          aria-label={
            typeof title === 'string'
              ? selectors.components.Drawer.General.title(title)
              : selectors.components.Drawer.General.title('no title')
          }
          className={styles.container}
          {...overlayProps}
          {...dialogProps}
          ref={overlayRef}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className={cx(dragStyles.dragHandleVertical, styles.resizer)}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          />
          <div className={cx(styles.header, Boolean(tabs) && styles.headerWithTabs)}>
            <div className={styles.actions}>
              <IconButton
                name="times"
                variant="secondary"
                onClick={onClose}
                data-testid={selectors.components.Drawer.General.close}
                tooltip={t(`grafana-ui.drawer.close`, 'Close')}
              />
            </div>
            {typeof title === 'string' ? (
              <Stack direction="column">
                <Text element="h3" truncate {...titleProps}>
                  {title}
                </Text>
                {subtitle && (
                  <Text element="p" color="secondary" truncate>
                    {subtitle}
                  </Text>
                )}
              </Stack>
            ) : (
              title
            )}
            {tabs && <div className={styles.tabsWrapper}>{tabs}</div>}
          </div>
          {!scrollableContent ? content : <ScrollContainer showScrollIndicators>{content}</ScrollContainer>}
        </div>
      </FocusScope>
    </RcDrawer>
  );
}

function useResizebleDrawer(): [
  string | undefined,
  React.EventHandler<React.MouseEvent>,
  React.EventHandler<React.TouchEvent>,
] {
  const [drawerWidth, setDrawerWidth] = useState<string | undefined>(undefined);

  const onMouseMove = useCallback((e: MouseEvent) => {
    setDrawerWidth(getCustomDrawerWidth(e.clientX));
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    setDrawerWidth(getCustomDrawerWidth(touch.clientX));
  }, []);

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
    // we will only add listeners when needed, and remove them afterward
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    // we will only add listeners when needed, and remove them afterward
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }

  return [drawerWidth, onMouseDown, onTouchStart];
}

function getCustomDrawerWidth(clientX: number) {
  let offsetRight = document.body.offsetWidth - (clientX - document.body.offsetLeft);
  let widthPercent = Math.min((offsetRight / document.body.clientWidth) * 100, 98).toFixed(2);
  return `${widthPercent}vw`;
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
      top: 0,

      '.rc-drawer-content-wrapper': {
        boxShadow: theme.shadows.z3,
      },
    }),
    drawerContent: css({
      backgroundColor: `${theme.colors.background.primary} !important`,
      display: 'flex',
      overflow: 'unset !important',
      flexDirection: 'column',
    }),
    drawerMotion: css({
      '&-appear': {
        transform: 'translateX(100%)',
        transition: 'none !important',

        '&-active': {
          transition: `${theme.transitions.create('transform')} !important`,
          transform: 'translateX(0)',
        },
      },
    }),
    // we want the mask itself to span the whole page including the top bar
    // this ensures trying to click something in the top bar will close the drawer correctly
    // but we don't want the backdrop styling to apply over the top bar as it looks weird
    // instead have a child pseudo element to apply the backdrop styling below the top bar
    mask: css({
      // The !important here is to override the default .rc-drawer-mask styles
      backgroundColor: 'transparent !important',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      position: 'fixed !important' as 'fixed',

      '&:before': {
        backgroundColor: `${theme.components.overlay.background} !important`,
        bottom: 0,
        content: '""',
        left: 0,
        position: 'fixed',
        right: 0,
        top: 0,
      },
    }),
    maskMotion: css({
      '&-appear': {
        opacity: 0,

        '&-active': {
          opacity: 1,
          transition: theme.transitions.create('opacity'),
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
      left: theme.spacing(-1),
      bottom: 0,
      position: 'absolute',
      zIndex: theme.zIndex.modal,
    }),
  };
};

function getWrapperStyles(theme: GrafanaTheme2, size: 'sm' | 'md' | 'lg') {
  return css({
    label: `drawer-content-wrapper-${size}`,
    overflow: 'unset !important',

    [theme.breakpoints.down('md')]: {
      width: `calc(100% - ${theme.spacing(2)}) !important`,
      minWidth: '0 !important',
    },
  });
}
