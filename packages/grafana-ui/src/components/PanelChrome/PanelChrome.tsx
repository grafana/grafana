import { css, cx } from '@emotion/css';
import React, { CSSProperties, ReactElement, ReactNode } from 'react';

import { GrafanaTheme2, isIconName, LoadingState } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';
import { IconButton, IconButtonVariant } from '../IconButton/IconButton';
import { LoadingBar } from '../LoadingBar/LoadingBar';
import { PopoverContent, Tooltip } from '../Tooltip';

/**
 * @internal
 */
export interface PanelChromeInfoState {
  icon: IconName;
  label?: string | ReactNode;
  tooltip?: PopoverContent;
  variant?: IconButtonVariant;
  onClick?: () => void;
}

/**
 * @internal
 */
export interface PanelChromeProps {
  width: number;
  height: number;
  children: (innerWidth: number, innerHeight: number) => ReactNode;
  padding?: PanelPadding;
  title?: string;
  titleItems?: PanelChromeInfoState[];
  menu?: ReactElement;
  /** dragClass, hoverHeader not yet implemented */
  // dragClass?: string;
  hoverHeader?: boolean;
  loadingState?: LoadingState;
  dataStateNode?: ReactNode;
  /** @deprecated in favor of props
   * dataStateNode, onStreamingStop, loadingState
   * which will serve the same purpose
   * of showing/interacting with the panel's data state
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
export function PanelChrome({
  width,
  height,
  children,
  padding = 'md',
  title = '',
  titleItems = [],
  menu,
  // dragClass,
  hoverHeader = false,
  loadingState,
  dataStateNode = null,
  leftItems = [],
}: PanelChromeProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const headerHeight = getHeaderHeight(theme, title, leftItems);
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(padding, theme, width, headerHeight, height);

  const headerStyles: CSSProperties = {
    height: headerHeight,
  };
  const itemStyles: CSSProperties = {
    minHeight: headerHeight,
    minWidth: headerHeight,
  };
  const containerStyles: CSSProperties = { width, height };

  const isUsingDeprecatedLeftItems = !dataStateNode && leftItems.length > 0;
  const showLoading = loadingState === LoadingState.Loading && !isUsingDeprecatedLeftItems;
  const showStreaming = loadingState === LoadingState.Streaming && !isUsingDeprecatedLeftItems;

  return (
    <div className={styles.container} style={containerStyles}>
      <div className={styles.loadingBarContainer}>
        {showLoading ? <LoadingBar width={'128px'} height={'2px'} /> : null}
      </div>

      <div className={styles.headerContainer} style={headerStyles} data-testid="header-container">
        {title && (
          <div title={title} className={styles.title}>
            {title}
          </div>
        )}

        {showStreaming && (
          <div className={styles.item} style={itemStyles}>
            <Tooltip content="Streaming">
              <Icon name="circle" type="mono" size="sm" className={styles.streaming} />
            </Tooltip>
          </div>
        )}

        {titleItems.length > 0 && (
          <div className={styles.items} data-testid="title-items-container">
            {titleItems
              .filter((item) => isIconName(item.icon))
              .map((item, i) => (
                <div key={`${item.icon}-${i}`} className={styles.item} style={itemStyles}>
                  {item.onClick ? (
                    <IconButton tooltip={item.tooltip} name={item.icon} size="sm" onClick={item.onClick} />
                  ) : (
                    <Tooltip content={item.tooltip ?? ''}>
                      <Icon name={item.icon} size="sm" />
                    </Tooltip>
                  )}
                </div>
              ))}
          </div>
        )}

        {menu && (
          <Dropdown overlay={menu} placement="bottom">
            <div className={cx(styles.item, styles.menuItem, 'menu-icon')} data-testid="menu-icon" style={itemStyles}>
              <IconButton
                ariaLabel={`Menu for panel with ${title ? `title ${title}` : 'no title'}`}
                tooltip="Menu"
                name="ellipsis-v"
                size="sm"
              />
            </div>
          </Dropdown>
        )}

        {isUsingDeprecatedLeftItems ? (
          <div className={cx(styles.rightAligned, styles.items)}>{itemsRenderer(leftItems, (item) => item)}</div>
        ) : (
          <div className={styles.errorContainer}>{dataStateNode}</div>
        )}
      </div>

      <div className={styles.content} style={contentStyle}>
        {children(innerWidth, innerHeight)}
      </div>
    </div>
  );
}

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
    loadingBarContainer: css({
      position: 'absolute',
      top: 0,
      width: '100%',
      overflow: 'hidden',
    }),
    content: css({
      label: 'panel-content',
      width: '100%',
      flexGrow: 1,
      contain: 'strict',
    }),
    headerContainer: css({
      label: 'panel-header',
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${theme.spacing(padding)}`,
    }),
    streaming: css({
      marginRight: 0,
      color: theme.colors.success.text,

      '&:hover': {
        color: theme.colors.success.text,
      },
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
      justifyContent: 'center',
      alignItems: 'center',
    }),
    menuItem: css({
      visibility: 'hidden',
    }),
    errorContainer: css({
      label: 'error-container',
      position: 'absolute',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    rightAligned: css({
      marginLeft: 'auto',
    }),
  };
};
