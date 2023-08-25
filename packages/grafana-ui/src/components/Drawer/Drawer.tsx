import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import RcDrawer from 'rc-drawer';
import React, { ReactNode, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { Button } from '../Button';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
//import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';

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
  /** Set to true if the component rendered within in drawer content has its own scroll */
  scrollableContent?: boolean;
  /** Callback for closing the drawer */
  onClose: () => void;
}

export function Drawer({
  children,
  onClose,
  closeOnMaskClick = true,
  scrollableContent = false,
  title,
  subtitle,
  width,
  size = 'md',
  tabs,
}: Props) {
  const styles = useStyles2(getStyles);
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

  // Apply size styles (unless deprecated width prop is used)
  const rootClass = cx(styles.drawer, !width && styles.sizes[size]);
  const content = <div className={styles.content}>{children}</div>;

  return (
    <RcDrawer
      open={true}
      onClose={onClose}
      placement="right"
      // Important to set this to empty string so that the width can be controlled by the css
      width={width ?? ''}
      getContainer={'.main-view'}
      className={styles.drawerContent}
      rootClassName={rootClass}
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
          {typeof title === 'string' && (
            <div className={cx(styles.header, Boolean(tabs) && styles.headerWithTabs)}>
              <div className={styles.actions}>
                <Button
                  icon="times"
                  variant="secondary"
                  fill="text"
                  onClick={onClose}
                  aria-label={selectors.components.Drawer.General.close}
                />
              </div>
              <div className={styles.titleWrapper}>
                <Text element="h3" {...titleProps}>
                  {title}
                </Text>
                {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                {tabs && <div className={styles.tabsWrapper}>{tabs}</div>}
              </div>
            </div>
          )}
          {typeof title !== 'string' && title}
          <div className={styles.contentScroll}>
            {!scrollableContent ? content : <CustomScrollbar autoHeightMin="100%">{content}</CustomScrollbar>}
          </div>
        </div>
      </FocusScope>
    </RcDrawer>
  );
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
    }),
    drawer: css({
      '.main-view &': {
        top: 81,
      },

      '.main-view--search-bar-hidden &': {
        top: 41,
      },

      '.main-view--chrome-hidden &': {
        top: 0,
      },

      '.rc-drawer-content-wrapper': {
        boxShadow: theme.shadows.z3,

        [theme.breakpoints.down('sm')]: {
          width: `calc(100% - ${theme.spacing(2)}) !important`,
          minWidth: '0 !important',
        },
      },
    }),
    sizes: {
      sm: css({
        '.rc-drawer-content-wrapper': {
          label: 'drawer-sm',
          width: '25vw',
          minWidth: theme.spacing(48),
        },
      }),
      md: css({
        '.rc-drawer-content-wrapper': {
          label: 'drawer-md',
          width: '50vw',
          minWidth: theme.spacing(60),
        },
      }),
      lg: css({
        '.rc-drawer-content-wrapper': {
          label: 'drawer-lg',
          width: '75vw',
          minWidth: theme.spacing(93),

          [theme.breakpoints.down('md')]: {
            width: `calc(100% - ${theme.spacing(2)}) !important`,
            minWidth: 0,
          },
        },
      }),
    },
    drawerContent: css({
      backgroundColor: `${theme.colors.background.primary} !important`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: theme.zIndex.dropdown,
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
      backgroundColor: 'transparent',
      position: 'fixed',

      '&:before': {
        backgroundColor: `${theme.components.overlay.background} !important`,
        backdropFilter: 'blur(1px)',
        bottom: 0,
        content: '""',
        left: 0,
        position: 'fixed',
        right: 0,

        '.main-view &': {
          top: 81,
        },

        '.main-view--search-bar-hidden &': {
          top: 41,
        },

        '.main-view--chrome-hidden &': {
          top: 0,
        },
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
      flexGrow: 0,
      padding: theme.spacing(3, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerWithTabs: css({
      borderBottom: 'none',
    }),
    actions: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(2),
    }),
    titleWrapper: css({
      overflowWrap: 'break-word',
    }),
    subtitle: css({
      color: theme.colors.text.secondary,
      paddingTop: theme.spacing(1),
    }),
    content: css({
      padding: theme.spacing(2),
      height: '100%',
      flexGrow: 1,
    }),
    contentScroll: css({
      minHeight: 0,
      flex: 1,
    }),
    tabsWrapper: css({
      paddingLeft: theme.spacing(2),
      margin: theme.spacing(2, -1, -3, -3),
    }),
  };
};
