import React, { CSSProperties, FC, ReactNode, useState } from 'react';
import { GrafanaThemeV2 } from '@grafana/data';
import RcDrawer from 'rc-drawer';
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';

import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { IconButton } from '../IconButton/IconButton';
import { stylesFactory, useTheme2 } from '../../themes';

export interface Props {
  children: ReactNode;
  /** Title shown at the top of the drawer */
  title?: ReactNode;
  /** Subtitle shown below the title */
  subtitle?: ReactNode;
  /** Should the Drawer be closable by clicking on the mask, defaults to true */
  closeOnMaskClick?: boolean;
  /** Render the drawer inside a container on the page */
  inline?: boolean;
  /** Either a number in px or a string with unit postfix */
  width?: number | string;
  /** Should the Drawer be expandable to full width */
  expandable?: boolean;

  /** Set to true if the component rendered within in drawer content has its own scroll */
  scrollableContent?: boolean;

  /** Callback for closing the drawer */
  onClose: () => void;
}

const getStyles = stylesFactory((theme: GrafanaThemeV2, scrollableContent: boolean) => {
  return {
    drawer: css`
      .drawer-content {
        background-color: ${theme.colors.background.primary};
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      &.drawer-open .drawer-mask {
        background-color: ${theme.components.overlay.background};
        backdrop-filter: blur(1px);
        opacity: 1;
      }
      .drawer-mask {
        background-color: ${theme.components.overlay.background};
        backdrop-filter: blur(1px);
      }
      .drawer-open .drawer-content-wrapper {
        box-shadow: ${theme.shadows.z3};
      }
      z-index: ${theme.zIndex.dropdown};
    `,
    header: css`
      background-color: ${theme.colors.background.canvas};
      z-index: 1;
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
    `,
    titleSpacing: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    content: css`
      padding: ${theme.spacing(2)};
      flex-grow: 1;
      overflow: ${!scrollableContent ? 'hidden' : 'auto'};
      z-index: 0;
      height: 100%;
    `,
  };
});

export const Drawer: FC<Props> = ({
  children,
  inline = false,
  onClose,
  closeOnMaskClick = true,
  scrollableContent = false,
  title,
  subtitle,
  width = '40%',
  expandable = false,
}) => {
  const theme = useTheme2();
  const drawerStyles = getStyles(theme, scrollableContent);
  const [isExpanded, setIsExpanded] = useState(false);
  const currentWidth = isExpanded ? '100%' : width;

  return (
    <RcDrawer
      level={null}
      handler={false}
      open={true}
      onClose={onClose}
      maskClosable={closeOnMaskClick}
      placement="right"
      width={currentWidth}
      getContainer={inline ? false : 'body'}
      style={{ position: `${inline && 'absolute'}` } as CSSProperties}
      className={drawerStyles.drawer}
      aria-label={
        typeof title === 'string'
          ? selectors.components.Drawer.General.title(title)
          : selectors.components.Drawer.General.title('no title')
      }
    >
      {typeof title === 'string' && (
        <div className={drawerStyles.header}>
          <div className={drawerStyles.actions}>
            {expandable && !isExpanded && (
              <IconButton
                name="angle-left"
                size="xl"
                onClick={() => setIsExpanded(true)}
                surface="header"
                aria-label={selectors.components.Drawer.General.expand}
              />
            )}
            {expandable && isExpanded && (
              <IconButton
                name="angle-right"
                size="xl"
                onClick={() => setIsExpanded(false)}
                surface="header"
                aria-label={selectors.components.Drawer.General.contract}
              />
            )}
            <IconButton
              name="times"
              size="xl"
              onClick={onClose}
              surface="header"
              aria-label={selectors.components.Drawer.General.close}
            />
          </div>
          <div className={drawerStyles.titleWrapper}>
            <h3>{title}</h3>
            {typeof subtitle === 'string' && <div className="muted">{subtitle}</div>}
            {typeof subtitle !== 'string' && subtitle}
          </div>
        </div>
      )}
      {typeof title !== 'string' && title}
      <div className={drawerStyles.content}>
        {!scrollableContent ? children : <CustomScrollbar>{children}</CustomScrollbar>}
      </div>
    </RcDrawer>
  );
};
