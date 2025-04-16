import { css, cx } from '@emotion/css';
import { CSSProperties, ReactElement, ReactNode, useId, useState } from 'react';
import * as React from 'react';
import { useMeasure, useToggle } from 'react-use';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { usePointerDistance } from '../../utils';
import { DelayRender } from '../../utils/DelayRender';
import { useElementSelection } from '../ElementSelectionContext/ElementSelectionContext';
import { Icon } from '../Icon/Icon';
import { LoadingBar } from '../LoadingBar/LoadingBar';
import { Text } from '../Text/Text';
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
  title?: string | React.ReactElement;
  description?: string | (() => string);
  titleItems?: ReactNode;
  menu?: ReactElement | (() => ReactElement);
  dragClass?: string;
  dragClassCancel?: string;
  onDragStart?: (e: React.PointerEvent) => void;
  selectionId?: string;
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
  /**
   * Used for setting panel attention
   */
  onFocus?: () => void;
  /**
   * Debounce the event handler, if possible
   */
  onMouseMove?: () => void;
  onMouseEnter?: () => void;
  /**
   * If true, the VizPanelMenu will always be visible in the panel header. Defaults to false.
   */
  showMenuAlways?: boolean;
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
  collapsed?: boolean;
  /**
   * callback when collapsing or expanding the panel
   */
  onToggleCollapse?: (collapsed: boolean) => void;
  hoverHeader?: never;
  hoverHeaderOffset?: never;
}

interface HoverHeader {
  collapsible?: never;
  collapsed?: never;
  showMenuAlways?: never;
  onToggleCollapse?: never;
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
  selectionId,
  onCancelQuery,
  onOpenMenu,
  collapsible = false,
  collapsed,
  onToggleCollapse,
  onFocus,
  onMouseMove,
  onMouseEnter,
  onDragStart,
  showMenuAlways = false,
}: PanelChromeProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const panelContentId = useId();
  const panelTitleId = useId().replace(/:/g, '_');
  const { isSelected, onSelect, isSelectable } = useElementSelection(selectionId);
  const pointerDistance = usePointerDistance();

  const hasHeader = !hoverHeader;

  const [isOpen, toggleOpen] = useToggle(true);

  // Highlight the full panel when hovering over header
  const [selectableHighlight, setSelectableHighlight] = useState(false);
  const onHeaderEnter = React.useCallback(() => setSelectableHighlight(true), []);
  const onHeaderLeave = React.useCallback(() => setSelectableHighlight(false), []);

  // if collapsed is not defined, then component is uncontrolled and state is managed internally
  if (collapsed === undefined) {
    collapsed = !isOpen;
  }

  // hover menu is only shown on hover when not on touch devices
  const showOnHoverClass = showMenuAlways ? 'always-show' : 'show-on-hover';
  const isPanelTransparent = displayMode === 'transparent';

  const headerHeight = getHeaderHeight(theme, hasHeader);
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(
    padding,
    theme,
    headerHeight,
    collapsed,
    height,
    width
  );

  const headerStyles: CSSProperties = {
    height: headerHeight,
    cursor: dragClass ? 'move' : 'auto',
  };

  const containerStyles: CSSProperties = { width, height: collapsed ? undefined : height };
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();

  /** Old property name now maps to actions */
  if (leftItems) {
    actions = leftItems;
  }

  const testid = typeof title === 'string' ? selectors.components.Panels.Panel.title(title) : 'Panel';

  // Handle drag & selection events
  // Mainly the tricky bit of differentiating between dragging and selecting
  const onPointerUp = React.useCallback(
    (evt: React.PointerEvent) => {
      if (
        pointerDistance.check(evt) ||
        (dragClassCancel && evt.target instanceof Element && evt.target.closest(`.${dragClassCancel}`))
      ) {
        return;
      }

      // setTimeout is needed here because onSelect stops the event propagation
      // By doing so, the event won't get to the document and drag will never be stopped
      setTimeout(() => onSelect?.(evt));
    },
    [dragClassCancel, onSelect, pointerDistance]
  );

  const onPointerDown = React.useCallback(
    (evt: React.PointerEvent) => {
      evt.stopPropagation();

      pointerDistance.set(evt);

      onDragStart?.(evt);
    },
    [pointerDistance, onDragStart]
  );

  const onContentPointerDown = React.useCallback(
    (evt: React.PointerEvent) => {
      // Ignore clicks inside buttons, links, canvas and svg elments
      // This does prevent a clicks inside a graphs from selecting panel as there is normal div above the canvas element that intercepts the click
      if (evt.target instanceof Element && evt.target.closest('button,a,canvas,svg')) {
        return;
      }

      onSelect?.(evt);
    },
    [onSelect]
  );

  const headerContent = (
    <>
      {/* Non collapsible title */}
      {!collapsible && title && (
        <div className={styles.title}>
          <Text
            element="h2"
            variant="h6"
            truncate
            title={typeof title === 'string' ? title : undefined}
            id={panelTitleId}
          >
            {title}
          </Text>
        </div>
      )}

      {/* Collapsible title */}
      {collapsible && (
        <div className={styles.title}>
          <Text element="h2" variant="h6">
            <button
              type="button"
              className={styles.clearButtonStyles}
              onClick={() => {
                toggleOpen();
                if (onToggleCollapse) {
                  onToggleCollapse(!collapsed);
                }
              }}
              aria-expanded={!collapsed}
              aria-controls={!collapsed ? panelContentId : undefined}
            >
              <Icon
                name={!collapsed ? 'angle-down' : 'angle-right'}
                aria-hidden={!!title}
                aria-label={!title ? 'toggle collapse panel' : undefined}
              />
              <Text variant="h6" truncate id={panelTitleId}>
                {title}
              </Text>
            </button>
          </Text>
        </div>
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
    </>
  );

  return (
    // tabIndex={0} is needed for keyboard accessibility in the plot area
    <section
      className={cx(
        styles.container,
        isPanelTransparent && styles.transparentContainer,
        isSelected && 'dashboard-selected-element',
        !isSelected && isSelectable && selectableHighlight && 'dashboard-selectable-element'
      )}
      style={containerStyles}
      aria-labelledby={!!title ? panelTitleId : undefined}
      data-testid={testid}
      tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex
      onFocus={onFocus}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      ref={ref}
    >
      <div className={styles.loadingBarContainer}>
        {loadingState === LoadingState.Loading ? (
          <LoadingBar width={loadingBarWidth} ariaLabel="Panel loading bar" />
        ) : null}
      </div>

      {hoverHeader && (
        <>
          <HoverWidget
            menu={menu}
            title={typeof title === 'string' ? title : undefined}
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
        <div
          className={cx(styles.headerContainer, dragClass)}
          style={headerStyles}
          data-testid="header-container"
          onPointerDown={onPointerDown}
          onMouseEnter={isSelectable ? onHeaderEnter : undefined}
          onMouseLeave={isSelectable ? onHeaderLeave : undefined}
          onPointerUp={onPointerUp}
        >
          {statusMessage && (
            <div className={dragClassCancel}>
              <PanelStatus message={statusMessage} onClick={statusMessageOnClick} ariaLabel="Panel status" />
            </div>
          )}

          {headerContent}

          {menu && (
            <PanelMenu
              menu={menu}
              title={typeof title === 'string' ? title : undefined}
              placement="bottom-end"
              menuButtonClass={cx(styles.menuItem, dragClassCancel, showOnHoverClass)}
              onOpenMenu={onOpenMenu}
            />
          )}
        </div>
      )}

      {!collapsed && (
        <div
          id={panelContentId}
          data-testid={selectors.components.Panels.Panel.content}
          className={cx(styles.content, height === undefined && styles.containNone)}
          style={contentStyle}
          onPointerDown={onContentPointerDown}
        >
          {typeof children === 'function' ? children(innerWidth, innerHeight) : children}
        </div>
      )}
    </section>
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
  collapsed: boolean,
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

  let innerHeight = 0;
  if (height) {
    innerHeight = height - headerHeight - panelPadding - panelBorder;
  }

  if (collapsed) {
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

      '.always-show': {
        background: 'none',
        '&:focus-visible, &:hover': {
          background: theme.colors.secondary.shade,
        },
      },

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
      // this is to force the loading bar container to create a new stacking context
      // otherwise, in webkit browsers on windows/linux, the aliasing of panel text changes when the loading bar is shown
      // see https://github.com/grafana/grafana/issues/88104
      zIndex: 1,
    }),
    containNone: css({
      contain: 'none',
    }),
    content: css({
      label: 'panel-content',
      flexGrow: 1,
      contain: 'size layout',
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
      display: 'flex',
      padding: theme.spacing(0, padding),
      minWidth: 0,
      '& > h2': {
        minWidth: 0,
      },
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
      zIndex: 1,
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
      display: 'flex',
      gap: theme.spacing(0.5),
      background: 'transparent',
      border: 'none',
      padding: 0,
      maxWidth: '100%',
    }),
  };
};
