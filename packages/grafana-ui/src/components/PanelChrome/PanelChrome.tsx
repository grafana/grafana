import { css, cx } from '@emotion/css';
import React, { CSSProperties, ReactElement, ReactNode } from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { LoadingBar } from '../LoadingBar/LoadingBar';
import { Tooltip } from '../Tooltip';

import { HoverWidget } from './HoverWidget';
import { PanelDescription } from './PanelDescription';
import { PanelMenu } from './PanelMenu';
import { PanelStatus } from './PanelStatus';
import { TitleItem } from './TitleItem';

/**
 * @internal
 */
export interface PanelChromeProps {
  width: number;
  height: number;
  children: (innerWidth: number, innerHeight: number) => ReactNode;
  padding?: PanelPadding;
  hoverHeaderOffset?: number;
  title?: string;
  description?: string | (() => string);
  titleItems?: ReactNode;
  menu?: ReactElement | (() => ReactElement);
  dragClass?: string;
  dragClassCancel?: string;
  hoverHeader?: boolean;
  /**
   * Use only to indicate loading or streaming data in the panel.
   * Any other values of loadingState are ignored.
   */
  loadingState?: LoadingState;
  /**
   * Used to display status message (used for panel errors currently)
   */
  statusMessage?: string;
  /**
   * Handle opening error details view (like inspect / error tab)
   */
  statusMessageOnClick?: (e: React.SyntheticEvent) => void;
  /**
   * @deprecated in favor of props
   * statusMessage for error messages
   * and loadingState for loading and streaming data
   * which will serve the same purpose
   * of showing/interacting with the panel's state
   */
  leftItems?: ReactNode[];
  displayMode?: 'default' | 'transparent';
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
  displayMode = 'default',
  titleItems,
  menu,
  dragClass,
  dragClassCancel,
  hoverHeader = false,
  hoverHeaderOffset,
  loadingState,
  statusMessage,
  statusMessageOnClick,
  leftItems,
}: PanelChromeProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // To Do rely on hoverHeader prop for header, not separate props
  // once hoverHeader is implemented
  //
  // Backwards compatibility for having a designated space for the header

  const hasHeader =
    hoverHeader === false &&
    (title.length > 0 ||
      titleItems !== undefined ||
      description !== '' ||
      loadingState === LoadingState.Streaming ||
      (leftItems?.length ?? 0) > 0);

  const headerHeight = getHeaderHeight(theme, hasHeader);
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(padding, theme, width, headerHeight, height);

  const headerStyles: CSSProperties = {
    height: headerHeight,
    cursor: dragClass ? 'move' : 'auto',
  };

  const containerStyles: CSSProperties = { width, height };
  if (displayMode === 'transparent') {
    containerStyles.backgroundColor = 'transparent';
    containerStyles.border = 'none';
  }

  const ariaLabel = title ? selectors.components.Panels.Panel.containerByTitle(title) : 'Panel';

  const headerContent = (
    <>
      {title && (
        <h6 title={title} className={styles.title}>
          {title}
        </h6>
      )}

      <PanelDescription description={description} className={dragClassCancel} />

      {titleItems !== undefined && (
        <div className={cx(styles.titleItems, dragClassCancel)} data-testid="title-items-container">
          {titleItems}
        </div>
      )}

      {loadingState === LoadingState.Streaming && (
        <Tooltip content="Streaming">
          <TitleItem className={dragClassCancel} data-testid="panel-streaming">
            <Icon name="circle-mono" size="md" className={styles.streaming} />
          </TitleItem>
        </Tooltip>
      )}
    </>
  );

  return (
    <div
      className={cx(styles.container, { [styles.regularHeader]: hasHeader })}
      style={containerStyles}
      aria-label={ariaLabel}
    >
      <div className={styles.loadingBarContainer}>
        {loadingState === LoadingState.Loading ? (
          <LoadingBar width={'28%'} height={'2px'} ariaLabel="Panel loading bar" />
        ) : null}
      </div>

      {(hoverHeader || !hasHeader) && menu && (
        <HoverWidget menu={menu} title={title} offset={hoverHeaderOffset} dragClass={dragClass}>
          {headerContent}
        </HoverWidget>
      )}

      {hasHeader && (
        <div className={cx(styles.headerContainer, dragClass)} style={headerStyles} data-testid="header-container">
          {headerContent}

          <div className={styles.rightAligned}>
            {menu && (
              <PanelMenu
                menu={menu}
                title={title}
                menuButtonClass={cx(styles.menuItem, dragClassCancel, 'show-on-hover')}
              />
            )}

            {leftItems && <div className={styles.leftItems}>{itemsRenderer(leftItems, (item) => item)}</div>}
          </div>
        </div>
      )}

      {statusMessage && (
        <PanelStatus
          className={cx(styles.errorContainer, dragClassCancel)}
          message={statusMessage}
          onClick={statusMessageOnClick}
          ariaLabel="Panel status"
        />
      )}

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
  const { background, borderColor, padding } = theme.components.panel;

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

      '.show-on-hover': {
        visibility: 'hidden',
        opacity: '0',
      },
      '&:focus-visible, &:hover': {
        // only show menu icon on hover or focused panel
        '.show-on-hover': {
          visibility: 'visible',
          opacity: '1',
        },
      },

      '&:focus-visible': {
        outline: `1px solid ${theme.colors.action.focus}`,
      },
    }),
    regularHeader: css({
      '&:focus-within': {
        '.show-on-hover': {
          visibility: 'visible',
          opacity: '1',
        },
      },
    }),
    loadingBarContainer: css({
      label: 'panel-loading-bar-container',
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
      padding: theme.spacing(0, 0, 0, padding),
    }),
    streaming: css({
      label: 'panel-streaming',
      marginRight: 0,
      color: theme.colors.success.text,

      '&:hover': {
        color: theme.colors.success.text,
      },
    }),
    title: css({
      label: 'panel-title',
      marginBottom: 0, // override default h6 margin-bottom
      paddingRight: theme.spacing(1),
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      maxWidth: theme.spacing(50),
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
      label: 'panel-menu',
      visibility: 'hidden',
      border: 'none',
    }),
    errorContainer: css({
      label: 'error-container',
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: theme.zIndex.tooltip,
    }),
    leftItems: css({
      display: 'flex',
      paddingRight: theme.spacing(padding),
    }),
    rightAligned: css({
      label: 'right-aligned-container',
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
    }),
    titleItems: css({
      display: 'flex',
      height: '100%',
    }),
  };
};
