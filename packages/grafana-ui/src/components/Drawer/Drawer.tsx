import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import RcDrawer from 'rc-drawer';
import React, { ReactNode, useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { IconButton } from '../IconButton/IconButton';

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
  /** Should the Drawer be expandable to full width */
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
  expandable = false,
  tabs,
}: Props) {
  const styles = useStyles2(getStyles);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const overlayRef = React.useRef(null);
  const { dialogProps, titleProps } = useDialog({}, overlayRef);
  const { overlayProps } = useOverlay(
    {
      isDismissable: false,
      isOpen,
      onClose,
    },
    overlayRef
  );

  // RcDrawer v4.x needs to be mounted in advance for animations to play.
  useEffect(() => {
    setIsOpen(true);
  }, []);

  // deprecated width prop now defaults to empty string which make the size prop take over
  const fixedWidth = isExpanded ? '100%' : width ?? '';
  const rootClass = cx(styles.drawer, !fixedWidth && styles.sizes[size]);
  const content = <div className={styles.content}>{children}</div>;

  return (
    <RcDrawer
      open={isOpen}
      onClose={onClose}
      placement="right"
      width={fixedWidth}
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
            <div className={styles.header}>
              <div className={styles.actions}>
                {expandable && !isExpanded && (
                  <IconButton
                    name="angle-left"
                    size="xl"
                    onClick={() => setIsExpanded(true)}
                    aria-label={selectors.components.Drawer.General.expand}
                  />
                )}
                {expandable && isExpanded && (
                  <IconButton
                    name="angle-right"
                    size="xl"
                    onClick={() => setIsExpanded(false)}
                    aria-label={selectors.components.Drawer.General.contract}
                  />
                )}
                <IconButton
                  name="times"
                  size="xl"
                  onClick={onClose}
                  aria-label={selectors.components.Drawer.General.close}
                />
              </div>
              <div className={styles.titleWrapper}>
                <h3 {...titleProps}>{title}</h3>
                {typeof subtitle === 'string' && <div className="muted">{subtitle}</div>}
                {typeof subtitle !== 'string' && subtitle}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      flex: 1 1 0;
    `,
    drawer: css`
      .rc-drawer-content-wrapper {
        box-shadow: ${theme.shadows.z3};

        ${theme.breakpoints.down('sm')} {
          width: calc(100% - ${theme.spacing(2)}) !important;
          min-width: 0 !important;
        }
      }
    `,
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
          minWidth: theme.spacing(66),
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
    drawerContent: css`
      background-color: ${theme.colors.background.primary} !important;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: ${theme.zIndex.dropdown};
    `,
    drawerMotion: css`
      &-appear {
        transform: translateX(100%);
        transition: none !important;

        &-active {
          transition: ${theme.transitions.create('transform')} !important;
          transform: translateX(0);
        }
      }
    `,
    mask: css`
      background-color: ${theme.components.overlay.background} !important;
      backdrop-filter: blur(1px);
    `,
    maskMotion: css`
      &-appear {
        opacity: 0;

        &-active {
          opacity: 1;
          transition: ${theme.transitions.create('opacity')};
        }
      }
    `,
    header: css`
      background-color: ${theme.colors.background.canvas};
      flex-grow: 0;
      padding-top: ${theme.spacing(0.5)};
    `,
    actions: css`
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
    `,
    titleWrapper: css`
      margin-bottom: ${theme.spacing(3)};
      padding: ${theme.spacing(0, 1, 0, 3)};
      overflow-wrap: break-word;
    `,
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
      margin: theme.spacing(3, -1, -3, -3),
    }),
  };
};
