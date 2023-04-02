import { css, cx } from '@emotion/css';
import React, { CSSProperties, ReactElement, ReactNode } from 'react';
import { useMedia } from 'react-use';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes';
import { DelayRender } from '../../utils/DelayRender';
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
   * @deprecated use `actions' instead
   **/
  leftItems?: ReactNode[];
  actions?: ReactNode[];
  displayMode?: 'default' | 'transparent';
  onCancelQuery?: () => void;
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
  actions,
  onCancelQuery,
}: PanelChromeProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const pointerQuery = '(pointer: coarse)';
  // detect if we are on touch devices
  const isTouchDevice = useMedia(pointerQuery);
  const hasHeader = !hoverHeader || isTouchDevice;

  // hover menu is only shown on hover when not on touch devices
  const showOnHoverClass = !isTouchDevice ? 'show-on-hover' : '';

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

  /** Old property name now maps to actions */
  if (leftItems) {
    actions = leftItems;
  }

  const ariaLabel = title ? selectors.components.Panels.Panel.containerByTitle(title) : 'Panel';

  const headerContent = (
    <>
      {title && (
        <h6 title={title} className={styles.title}>
          {title}
        </h6>
      )}

      <div className={cx(styles.titleItems, dragClassCancel)} data-testid="title-items-container">
        <PanelDescription description={description} className={dragClassCancel} />
        {titleItems}
      </div>

      {loadingState === LoadingState.Streaming && (
        <Tooltip content={onCancelQuery ? 'Stop streaming' : 'Streaming'}>
          <TitleItem className={dragClassCancel} data-testid="panel-streaming" onClick={onCancelQuery}>
            <Icon name="circle-mono" size="md" className={styles.streaming} />
          </TitleItem>
        </Tooltip>
      )}
      {loadingState === LoadingState.Loading && onCancelQuery && (
        <DelayRender delay={2000}>
          <Tooltip content="Cancel query">
            <TitleItem className={dragClassCancel} data-testid="panel-cancel-query" onClick={onCancelQuery}>
              <Icon name="sync-slash" size="md" />
            </TitleItem>
          </Tooltip>
        </DelayRender>
      )}
    </>
  );

  return (
    <div className={styles.container} style={containerStyles} aria-label={ariaLabel}>
      <div className={styles.loadingBarContainer}>
        {loadingState === LoadingState.Loading ? <LoadingBar width={width} ariaLabel="Panel loading bar" /> : null}
      </div>

      {hoverHeader && !isTouchDevice && (
        <>
          {menu && (
            <HoverWidget menu={menu} title={title} offset={hoverHeaderOffset} dragClass={dragClass}>
              {headerContent}
            </HoverWidget>
          )}
          {statusMessage && (
            <div className={styles.errorContainerFloating}>
              <PanelStatus message={statusMessage} onClick={statusMessageOnClick} ariaLabel="Panel status" />
            </div>
          )}
        </>
      )}

      {hasHeader && (
        <div className={cx(styles.headerContainer, dragClass)} style={headerStyles} data-testid="header-container">
          {statusMessage && (
            <div className={dragClassCancel}>
              <PanelStatus message={statusMessage} onClick={statusMessageOnClick} ariaLabel="Panel status" />
            </div>
          )}

          {headerContent}

          <div className={styles.rightAligned}>
            {actions && <div className={styles.rightActions}>{itemsRenderer(actions, (item) => item)}</div>}
            {menu && (
              <PanelMenu
                menu={menu}
                title={title}
                placement="bottom-end"
                menuButtonClass={cx(
                  { [styles.hiddenMenu]: !isTouchDevice },
                  styles.menuItem,
                  dragClassCancel,
                  showOnHoverClass
                )}
              />
            )}
          </div>
        </div>
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
      borderRadius: theme.shape.borderRadius(1),
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
      padding: theme.spacing(0, padding),
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
    hiddenMenu: css({
      visibility: 'hidden',
    }),
    menuItem: css({
      label: 'panel-menu',
      border: 'none',
      background: theme.colors.secondary.main,
      '&:hover': {
        background: theme.colors.secondary.shade,
      },
    }),
    errorContainerFloating: css({
      label: 'error-container',
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: theme.zIndex.tooltip,
    }),
    rightActions: css({
      display: 'flex',
      padding: theme.spacing(0, padding / 2, 0, padding / 2),
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
