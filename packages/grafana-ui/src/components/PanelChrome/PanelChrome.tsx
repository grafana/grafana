import { css, cx } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { CSSProperties, ReactNode } from 'react';

import { GrafanaTheme2, LinkModel, PanelModel, QueryResultMetaNotice, LoadingState } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { LoadingBar } from '../LoadingBar/LoadingBar';
import { Tooltip } from '../Tooltip';

import { PanelDescription } from './PanelDescription';
import { PanelLinks } from './PanelLinks';
import { PanelNotices } from './PanelNotices';
import { PanelStatus } from './PanelStatus';

interface Status {
  message?: string;
  onClick?: (e: React.SyntheticEvent) => void;
}

interface Notices {
  getPanelNotices: () => QueryResultMetaNotice[];
  onClick?: (e: React.SyntheticEvent, tab: string) => void;
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
  description?: string | (() => string);
  links?: () => Array<LinkModel<PanelModel>>;
  panelNotices?: Notices;
  titleItems?: ReactNode[];
  menu?: React.ReactElement;
  /** dragClass, hoverHeader not yet implemented */
  // dragClass?: string;
  hoverHeader?: boolean;
  loadingState?: LoadingState;
  status?: Status;
  /** @deprecated in favor of props
   * status for errors and loadingState for loading and streaming
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
  description = '',
  links,
  panelNotices,
  titleItems = [],
  menu,
  // dragClass,
  hoverHeader = false,
  loadingState,
  status,
  leftItems = [],
}: PanelChromeProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // To Do rely on hoverHeader prop for header, not separate props
  // once hoverHeader is implemented
  const hasHeader = title.length > 0 || leftItems.length > 0;

  const headerHeight = getHeaderHeight(theme, hasHeader);
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(padding, theme, width, headerHeight, height);

  const headerStyles: CSSProperties = {
    height: headerHeight,
  };
  const itemStyles: CSSProperties = {
    minHeight: headerHeight,
    minWidth: headerHeight,
  };
  const containerStyles: CSSProperties = { width, height };

  const isUsingDeprecatedLeftItems = isEmpty(status) && !loadingState;
  const showLoading = loadingState === LoadingState.Loading && !isUsingDeprecatedLeftItems;
  const showStreaming = loadingState === LoadingState.Streaming && !isUsingDeprecatedLeftItems;

  const renderStatus = () => {
    if (isUsingDeprecatedLeftItems) {
      return <div className={cx(styles.rightAligned, styles.items)}>{itemsRenderer(leftItems, (item) => item)}</div>;
    } else {
      const showError = loadingState === LoadingState.Error || status?.message;
      return showError ? (
        <div className={styles.errorContainer}>
          <PanelStatus message={status?.message} onClick={status?.onClick} />
        </div>
      ) : null;
    }
  };
  return (
    <div className={styles.container} style={containerStyles}>
      <div className={styles.loadingBarContainer}>
        {showLoading ? <LoadingBar width={'28%'} height={'2px'} /> : null}
      </div>

      <div className={styles.headerContainer} style={headerStyles} data-testid="header-container">
        {title && (
          <h6 title={title} className={styles.title}>
            {title}
          </h6>
        )}

        {panelNotices && typeof panelNotices.getPanelNotices === 'function' && (
          <PanelNotices notices={panelNotices.getPanelNotices()} onClick={panelNotices.onClick} />
        )}

        <PanelDescription description={description} />

        <PanelLinks links={links} />

        <div className={styles.titleItems} data-testid="title-items">
          {itemsRenderer(titleItems, (item) => item)}
        </div>

        {showStreaming && (
          <div className={styles.item} style={itemStyles}>
            <Tooltip content="Streaming">
              <Icon name="circle" type="mono" size="sm" className={styles.streaming} />
            </Tooltip>
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
        {renderStatus()}
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

const getHeaderHeight = (theme: GrafanaTheme2, hasHeader: boolean) => {
  if (hasHeader) {
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

  const panelPadding = chromePadding * 2;
  const panelBorder = 1 * 2;

  const innerWidth = width - panelPadding - panelBorder;
  const innerHeight = height - headerHeight - panelPadding - panelBorder;

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
      flex: '1 1 0',

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
      marginBottom: 0, // override default h6 margin-bottom
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.h6.fontWeight,
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
    titleItems: css({
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      padding: theme.spacing(1),
    }),
  };
};
