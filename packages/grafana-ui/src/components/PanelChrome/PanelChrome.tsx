import { css, cx } from '@emotion/css';
import React, { CSSProperties, ReactElement, ReactNode, useId } from 'react';
import { useMeasure, useToggle } from 'react-use';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
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
export type PanelChromeProps = (AutoSize | FixedDimensions) & (Collapsible | HoverHeader);

interface BaseProps {
  padding?: PanelPadding;
  title?: string;
  titlePlacement?: TitlePlacement;
  description?: string | (() => string);
  titleItems?: ReactNode;
  menu?: ReactElement | (() => ReactElement);
  dragClass?: string;
  dragClassCancel?: string;
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
  actions?: ReactNode;
  displayMode?: 'default' | 'transparent';
  onCancelQuery?: () => void;
  /**
   * callback when opening the panel menu
   */
  onOpenMenu?: () => void;
}

interface FixedDimensions extends BaseProps {
  width: number;
  height: number;
  children: (innerWidth: number, innerHeight: number) => ReactNode;
}

interface AutoSize extends BaseProps {
  width?: never;
  height?: never;
  children: ReactNode;
}

interface Collapsible {
  collapsible: boolean;
  hoverHeader?: never;
  hoverHeaderOffset?: never;
}

interface HoverHeader {
  collapsible?: never;
  hoverHeader?: boolean;
  hoverHeaderOffset?: number;
}

/**
 * @internal
 */
export type PanelPadding = 'none' | 'md';

/**
 * @internal
 */
export type TitlePlacement = 'left' | 'center' | 'right';

/**
 * @internal
 */
export function PanelChrome({
  width,
  height,
  children,
  padding = 'md',
  title = '',
  titlePlacement = 'center',
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
  onOpenMenu,
  collapsible = false,
}: PanelChromeProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const panelContentId = useId();

  const [isOpen, toggleOpen] = useToggle(true);

  const hasHeader = !hoverHeader;

  // hover menu is only shown on hover when not on touch devices
  const showOnHoverClass = 'show-on-hover';
  const isPanelTransparent = displayMode === 'transparent';

  const headerHeight = getHeaderHeight(theme, hasHeader);
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(
    padding,
    theme,
    headerHeight,
    isOpen,
    height,
    width
  );

  const headerStyles: CSSProperties = {
    height: headerHeight,
    cursor: dragClass ? 'move' : 'auto',
    justifyContent: 'space-between',
  };

  const containerStyles: CSSProperties = { width, height };
  if (displayMode === 'transparent') {
    containerStyles.backgroundColor = 'transparent';
    containerStyles.border = 'none';
  }

  const getTitlePlacementStyle = (pos: TitlePlacement) => {
    const placements = {
      left: styles.alignTitleLeft,
      center: styles.alignTitleCenter,
      right: styles.alignTitleRight,
    };
    return placements[pos];
  };

  const titleStyle = getTitlePlacementStyle(titlePlacement);

  const containerStyles: CSSProperties = { width, height: isOpen ? height : headerHeight };
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();

  /** Old property name now maps to actions */
  if (leftItems) {
    actions = leftItems;
  }

  const testid = title ? selectors.components.Panels.Panel.title(title) : 'Panel';

  const collapsibleHeader = (
    <h6 className={styles.title}>
      <button
        type="button"
        className={styles.clearButtonStyles}
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelContentId : undefined}
      >
        <Icon
          name={isOpen ? 'angle-down' : 'angle-right'}
          aria-hidden={!!title}
          aria-label={!title ? 'toggle collapse panel' : undefined}
        />
        {title}
      </button>
    </h6>
  );

  const headerContent = (
    <>
      {collapsible
        ? collapsibleHeader
        : title && (
        <h6 title={title} className={cx(styles.title, titleStyle)}>
          {title}
        </h6>
      )}
      <div>
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
              <TitleItem
                className={cx(dragClassCancel, styles.pointer)}
                data-testid="panel-cancel-query"
                onClick={onCancelQuery}
              >
                <Icon name="sync-slash" size="md" />
              </TitleItem>
            </Tooltip>
          </DelayRender>
        )}
        <div className={styles.rightAligned}>
          {actions && <div className={styles.rightActions}>{itemsRenderer(actions, (item) => item)}</div>}
        </div>
      </div>
    </>
  );

  return (
    // tabIndex={0} is needed for keyboard accessibility in the plot area
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className={styles.container} style={containerStyles} data-testid={testid} tabIndex={0} ref={ref}>
      <div className={styles.loadingBarContainer}>
        {loadingState === LoadingState.Loading ? (
          <LoadingBar width={loadingBarWidth} ariaLabel="Panel loading bar" />
        ) : null}
      </div>

      {hoverHeader && (
        <>
          <HoverWidget
            menu={menu}
            title={title}
            offset={hoverHeaderOffset}
            dragClass={dragClass}
            onOpenMenu={onOpenMenu}
          >
            {headerContent}
          </HoverWidget>

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

          {menu && (
            <PanelMenu
              menu={menu}
              title={title}
              placement="bottom-end"
              menuButtonClass={cx(styles.menuItem, dragClassCancel, showOnHoverClass)}
              onOpenMenu={onOpenMenu}
            />
          )}
        </div>
      )}

      {isOpen && (
        <div
          id={panelContentId}
          className={cx(styles.content, height === undefined && styles.containNone)}
          style={contentStyle}
        >
          {typeof children === 'function' ? children(innerWidth, innerHeight) : children}
        </div>
      )}
    </div>
  );
}

const itemsRenderer = (items: ReactNode[] | ReactNode, renderer: (items: ReactNode[]) => ReactNode): ReactNode => {
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
  headerHeight: number,
  isOpen: boolean,
  height?: number,
  width?: number
) => {
  const chromePadding = (padding === 'md' ? theme.components.panel.padding : 0) * theme.spacing.gridSize;

  const panelPadding = chromePadding * 2;
  const panelBorder = 1 * 2;

  let innerWidth = 0;
  if (width) {
    innerWidth = width - panelPadding - panelBorder;
  }

  const contentStyle: CSSProperties = {
    padding: chromePadding,
  };

  let innerHeight = 0;
  if (height) {
    innerHeight = height - headerHeight - panelPadding - panelBorder;
  }

  if (!isOpen) {
    innerHeight = headerHeight;
  }

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
      borderRadius: theme.shape.radius.default,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',

      '.show-on-hover': {
        opacity: '0',
        visibility: 'hidden',
      },

      '&:focus-visible, &:hover': {
        // only show menu icon on hover or focused panel
        '.show-on-hover': {
          opacity: '1',
          visibility: 'visible',
        },
      },

      '&:focus-visible': getFocusStyles(theme),

      // The not:(:focus) clause is so that this rule is only applied when decendants are focused (important otherwise the hover header is visible when panel is clicked).
      '&:focus-within:not(:focus)': {
        '.show-on-hover': {
          visibility: 'visible',
          opacity: '1',
        },
      },
    }),
    transparentContainer: css({
      label: 'panel-transparent-container',
      backgroundColor: 'transparent',
      border: '1px solid transparent',
      boxSizing: 'border-box',
      '&:hover': {
        border: `1px solid ${borderColor}`,
      },
    }),
    loadingBarContainer: css({
      label: 'panel-loading-bar-container',
      position: 'absolute',
      top: 0,
      width: '100%',
      overflow: 'hidden',
    }),
    containNone: css({
      contain: 'none',
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
    pointer: css({
      cursor: 'pointer',
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
    alignTitleLeft: css({
      label: 'title-left-aligned',
      marginRight: 'auto',
    }),
    alignTitleRight: css({
      label: 'title-right-aligned',
      marginLeft: 'auto',
    }),
    alignTitleCenter: css({
      label: 'title-center-aligned',
      marginLeft: 'auto',
      marginRight: 'auto',
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
      padding: theme.spacing(0, padding),
      gap: theme.spacing(1),
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
    clearButtonStyles: css({
      alignItems: 'center',
      background: 'transparent',
      color: theme.colors.text.primary,
      border: 'none',
      padding: 0,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.h6.fontWeight,
    }),
  };
};
