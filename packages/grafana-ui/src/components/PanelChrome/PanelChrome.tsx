import { css, cx } from '@emotion/css';
import React, { CSSProperties, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { Dropdown } from '../Dropdown/Dropdown';
import { IconButton } from '../IconButton/IconButton';

/**
 * @internal
 */
export interface PanelChromeProps {
  width: number;
  height: number;
  children: (innerWidth: number, innerHeight: number) => ReactNode;
  padding?: PanelPadding;
  title?: string;
  titleItems?: (innerWidth: number, innerHeight: number) => ReactNode;
  menu?: React.ReactElement;
  /** dragClass, hoverHeader, loadingState, and states not yet implemented */
  // dragClass?: string;
  hoverHeader?: boolean;
  // loadingState?: LoadingState;
  // states?: ReactNode[];
  /** @deprecated in favor of prop states
   * which will serve the same purpose
   * of showing the panel state in the top right corner
   * of itself or its header
   * */
  leftItems?: ReactNode[];
}

/**
 * @internal
 */
export type PanelPadding = 'none' | 'md';

/**
 * @internal
 */
export const PanelChrome: React.FC<PanelChromeProps> = ({
  width,
  height,
  children,
  padding = 'md',
  title = '',
  titleItems = () => null,
  menu,
  // dragClass,
  hoverHeader = false,
  // loadingState,
  // states = [],
  leftItems = [],
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const headerHeight = !hoverHeader ? getHeaderHeight(theme, title, leftItems) : 0;
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(padding, theme, width, headerHeight, height);

  const headerStyles: CSSProperties = {
    height: headerHeight,
  };
  const itemStyles: CSSProperties = {
    minHeight: headerHeight,
    minWidth: headerHeight,
  };
  const containerStyles: CSSProperties = { width, height };

  const handleMenuOpen = () => {};

  const hasHeader = title || titleItems.length > 0 || menu;

  return (
    <div className={styles.container} style={containerStyles}>
      {hasHeader && !hoverHeader && (
        <div className={styles.headerContainer} style={headerStyles} data-testid="header-container">
          {title && (
            <div title={title} className={styles.title}>
              {title}
            </div>
          )}

          <div data-testid="title-items">{titleItems(innerWidth, innerHeight)}</div>

          {menu && (
            <Dropdown overlay={menu} placement="bottom">
              <div className={cx(styles.item, styles.menuItem, 'menu-icon')} data-testid="menu-icon" style={itemStyles}>
                <IconButton
                  ariaLabel={`Menu for panel with ${title ? `title ${title}` : 'no title'}`}
                  tooltip="Menu"
                  name="ellipsis-v"
                  size="sm"
                  onClick={handleMenuOpen}
                />
              </div>
            </Dropdown>
          )}

          {leftItems.length > 0 && (
            <div className={cx(styles.rightAligned, styles.items)}>{itemsRenderer(leftItems, (item) => item)}</div>
          )}
        </div>
      )}

      <div className={styles.content} style={contentStyle}>
        {children(innerWidth, innerHeight)}
      </div>
    </div>
  );
};

const itemsRenderer = (items: ReactNode[], renderer: (items: ReactNode[]) => ReactNode): ReactNode => {
  const toRender = React.Children.toArray(items).filter(Boolean);
  return toRender.length > 0 ? renderer(toRender) : null;
};

const getHeaderHeight = (theme: GrafanaTheme2, title: string, items: ReactNode[]) => {
  if (title.length > 0 || items.length > 0) {
    return theme.spacing.gridSize * theme.components.panel.headerHeight;
  }
  return 0;
};

const getContentStyle = (
  padding: string,
  theme: GrafanaTheme2,
  width: number,
  headerHeight: number,
  height: number
) => {
  const chromePadding = (padding === 'md' ? theme.components.panel.padding : 0) * theme.spacing.gridSize;
  const panelBorder = 1 * 2;
  const innerWidth = width - chromePadding * 2 - panelBorder;
  const innerHeight = height - headerHeight - chromePadding * 2 - panelBorder;

  const contentStyle: CSSProperties = {
    padding: chromePadding,
  };

  return { contentStyle, innerWidth, innerHeight };
};

const getStyles = (theme: GrafanaTheme2) => {
  const { padding, background, borderColor } = theme.components.panel;

  return {
    container: css({
      label: 'panel-container',
      backgroundColor: background,
      border: `1px solid ${borderColor}`,
      position: 'relative',
      borderRadius: '3px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '0 0 0',

      '&:focus-visible, &:hover': {
        // only show menu icon on hover or focused panel
        '.menu-icon': {
          visibility: 'visible',
        },
      },

      '&:focus-visible': {
        outline: `1px solid ${theme.colors.action.focus}`,
      },
    }),
    content: css({
      label: 'panel-content',
      width: '100%',
      contain: 'strict',
      flexGrow: 1,
    }),
    headerContainer: css({
      label: 'panel-header',
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${theme.spacing(padding)}`,
    }),
    title: css({
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    items: css({
      display: 'flex',
    }),
    item: css({
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
    }),
    menuItem: css({
      visibility: 'hidden',
    }),
    rightAligned: css({
      marginLeft: 'auto',
    }),
  };
};
