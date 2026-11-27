import { css, cx } from '@emotion/css';
import {
  type ComponentType,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ContextMenu, IconButton, Menu, Spinner, Tab, useStyles2 } from '@grafana/ui';

import { canOpenAsPage, moveTabId, openPageCanvasTabAsPage, selectPageCanvasTab } from './navigation';
import { type PageCanvasModel, type PageCanvasTab } from './types';

interface Props {
  canvas: PageCanvasModel;
  /** The pane's element id, which a pane tab controls. */
  paneId: string;
}

interface MenuState {
  tabId: string;
  x: number;
  y: number;
}

/** Labels longer than this truncate, with the full label in a tooltip. */
const LONG_LABEL = 32;

export const pageCanvasTabElementId = (tabId: string) => `page-canvas-tab-${tabId}`;

type IndicatorComponent = ComponentType<{ className?: string }>;

const WorkingIndicator: IndicatorComponent = ({ className }) => (
  <span className={className} aria-hidden>
    <Spinner inline size="xs" />
  </span>
);

const UpdatedIndicator: IndicatorComponent = ({ className }) => {
  const styles = useStyles2(getStyles);
  return <span className={cx(styles.updatedDot, className)} aria-hidden />;
};

/** The page canvas's tab strip: the tabs and the canvas's actions. */
export function PageCanvasTabs({ canvas, paneId }: Props) {
  const styles = useStyles2(getStyles);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  // The tab to focus after the next render: the moved tab, or the active one once a focused tab closes.
  const refocus = useRef<string | 'active' | null>(null);
  const { tabs, activeTabId } = canvas;
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const order = tabs.map((tab) => tab.id);

  useEffect(() => {
    if (refocus.current === null) {
      return;
    }
    const id = refocus.current === 'active' ? canvas.activeTabId : refocus.current;
    refocus.current = null;
    document.getElementById(pageCanvasTabElementId(id))?.focus();
  });

  const close = (tabIds: string[], keepFocus = false) => {
    if (tabIds.length === 0) {
      return;
    }
    if (keepFocus) {
      refocus.current = 'active';
    }
    canvas.onClose(tabIds);
  };

  const move = (tab: PageCanvasTab, direction: -1 | 1) => {
    const index = order.indexOf(tab.id);
    const neighbour = order[index + direction];
    if (neighbour === undefined) {
      return;
    }
    refocus.current = tab.id;
    canvas.onReorder(moveTabId(order, tab.id, neighbour, direction === 1));
  };

  const menuItems = (tab: PageCanvasTab) => {
    const others = tabs.filter((other) => other.id !== tab.id && other.closable).map((other) => other.id);
    const toTheRight = tabs
      .slice(order.indexOf(tab.id) + 1)
      .filter((other) => other.closable)
      .map((other) => other.id);
    const closeItems = [
      tab.closable && (
        <Menu.Item
          key="close"
          label={t('app-chrome.page-canvas.close-tab', 'Close tab')}
          shortcut="Alt+W"
          onClick={() => close([tab.id], true)}
        />
      ),
      others.length > 0 && (
        <Menu.Item
          key="close-others"
          label={t('app-chrome.page-canvas.close-other-tabs', 'Close other tabs')}
          onClick={() => close(others, true)}
        />
      ),
      toTheRight.length > 0 && (
        <Menu.Item
          key="close-right"
          label={t('app-chrome.page-canvas.close-tabs-right', 'Close tabs to the right')}
          onClick={() => close(toTheRight, true)}
        />
      ),
    ].filter(Boolean);
    const pageItem = canOpenAsPage(canvas, tab) && (
      <Menu.Item
        key="open-as-page"
        icon="external-link-alt"
        label={t('app-chrome.page-canvas.open-as-page', 'Open as a Grafana page')}
        onClick={() => openPageCanvasTabAsPage(canvas, tab)}
      />
    );
    if (closeItems.length === 0) {
      return pageItem ? [pageItem] : [];
    }
    return pageItem ? [...closeItems, <Menu.Divider key="divider" />, pageItem] : closeItems;
  };

  const openMenu = (tab: PageCanvasTab, x: number, y: number) => {
    if (menuItems(tab).length > 0) {
      setMenu({ tabId: tab.id, x, y });
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLElement>, tab: PageCanvasTab) => {
    const tabList = event.currentTarget.closest('[role="tablist"]');
    const elements = Array.from(tabList?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const index = elements.indexOf(event.currentTarget);
    if (index === -1) {
      return;
    }
    const focusAt = (next: number) => {
      event.preventDefault();
      elements[(next + elements.length) % elements.length]?.focus();
    };
    if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      if (tab.reorderable) {
        event.preventDefault();
        move(tab, event.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      openMenu(tab, rect.left, rect.bottom);
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
        focusAt(index + 1);
        return;
      case 'ArrowLeft':
        focusAt(index - 1);
        return;
      case 'Home':
        focusAt(0);
        return;
      case 'End':
        focusAt(elements.length - 1);
        return;
      case 'Delete':
      case 'Backspace':
        if (tab.closable) {
          event.preventDefault();
          close([tab.id], true);
        }
        return;
    }
  };

  const dragHandlers = (tab: PageCanvasTab) => ({
    draggable: tab.reorderable,
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tab.id);
      setDragging(tab.id);
    },
    onDragEnd: () => setDragging(null),
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (dragging !== null && dragging !== tab.id && tab.reorderable) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (dragging === null || dragging === tab.id) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      canvas.onReorder(moveTabId(order, dragging, tab.id, event.clientX > rect.left + rect.width / 2));
      setDragging(null);
    },
  });

  const menuTab = menu ? tabs.find((tab) => tab.id === menu.tabId) : undefined;

  return (
    <div className={styles.strip} data-testid="page-canvas-tabs">
      <div role="tablist" aria-label={canvas.label} className={styles.tabList}>
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const longLabel = tab.label.length > LONG_LABEL;
          // A shortened label keeps its full text for screen readers, and an indicator adds its own.
          let accessibleName = longLabel ? tab.label : undefined;
          if (tab.indicator) {
            accessibleName = `${tab.label}, ${tab.indicator.label}`;
          }
          let suffix: IndicatorComponent | undefined;
          if (tab.indicator?.kind === 'working') {
            suffix = WorkingIndicator;
          } else if (tab.indicator?.kind === 'updated') {
            suffix = UpdatedIndicator;
          }
          return (
            <div
              key={tab.id}
              className={cx(styles.tabItem, dragging === tab.id && styles.tabItemDragging)}
              {...dragHandlers(tab)}
            >
              <Tab
                className={styles.tab}
                id={pageCanvasTabElementId(tab.id)}
                label={longLabel ? `${tab.label.slice(0, LONG_LABEL - 1).trimEnd()}…` : tab.label}
                active={active}
                icon={tab.icon}
                counter={tab.count}
                suffix={suffix}
                tooltip={longLabel ? tab.label : undefined}
                aria-label={accessibleName}
                aria-controls={tab.shows === 'pane' ? paneId : 'pageContent'}
                data-page-canvas-tab={tab.id}
                onChangeTab={() => selectPageCanvasTab(canvas, tab)}
                onKeyDown={(event: KeyboardEvent<HTMLElement>) => onTabKeyDown(event, tab)}
                onMouseDown={(event: MouseEvent<HTMLElement>) => {
                  if (event.button === 1) {
                    event.preventDefault();
                  }
                }}
                onAuxClick={(event: MouseEvent<HTMLElement>) => {
                  if (event.button === 1 && tab.closable) {
                    event.preventDefault();
                    close([tab.id]);
                  }
                }}
                onContextMenu={(event: MouseEvent<HTMLElement>) => {
                  event.preventDefault();
                  openMenu(tab, event.clientX, event.clientY);
                }}
              />
              {tab.closable && (
                <IconButton
                  name="times"
                  size="sm"
                  className={styles.closeButton}
                  tabIndex={-1}
                  aria-label={t('app-chrome.page-canvas.close-named-tab', 'Close {{label}}', { label: tab.label })}
                  onClick={() => close([tab.id])}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.actions}>
        {canOpenAsPage(canvas, activeTab) && (
          <IconButton
            name="external-link-alt"
            tooltip={t('app-chrome.page-canvas.open-as-page', 'Open as a Grafana page')}
            onClick={() => openPageCanvasTabAsPage(canvas, activeTab)}
          />
        )}
        <IconButton
          name="times"
          tooltip={t('app-chrome.page-canvas.close-canvas', 'Close canvas (Alt+C)')}
          onClick={() => canvas.onCloseCanvas()}
        />
      </div>
      {menu && menuTab && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          focusOnOpen
          onClose={() => setMenu(null)}
          renderMenuItems={() => menuItems(menuTab)}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  // The strip lines up with the Assistant's chat header beside it: the header is 40px with its divider inside, and
  // with the visual refresh the docked sidebar's card adds a 1px border above it.
  const headerHeight = 40;
  const visualRefresh = theme.flags.visualDesignRefresh;
  const border = `1px solid ${theme.colors.border.weak}`;
  return {
    strip: css(
      {
        boxSizing: 'border-box',
        height: headerHeight,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
        flex: 'none',
        minWidth: 0,
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        borderBottom: border,
        background: theme.colors.background.canvas,
      },
      // The top of the page's card, as the Assistant's card has its chat header: the page's card continues below the
      // divider (see PageCanvasJoin), with the same side gaps.
      visualRefresh && {
        height: headerHeight + 1,
        margin: theme.spacing(0, 0.5),
        borderTop: border,
        borderLeft: border,
        borderRight: border,
        borderTopLeftRadius: theme.shape.radius.lg,
        borderTopRightRadius: theme.shape.radius.lg,
        background: theme.colors.background.page,
      }
    ),
    tabList: css({
      display: 'flex',
      alignItems: 'stretch',
      alignSelf: 'stretch',
      flex: '1 1 auto',
      minWidth: 0,
      overflowX: 'auto',
      scrollbarWidth: 'thin',
    }),
    tabItem: css({
      display: 'flex',
      alignItems: 'stretch',
      flex: 'none',
    }),
    // Tabs fill the row, so the active underline sits on the divider, and use the chat header title's type.
    tab: css({
      '& > button': {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        height: '100%',
        padding: theme.spacing(0, 1.5),
        fontSize: theme.typography.bodySmall.fontSize,
        fontWeight: theme.typography.fontWeightMedium,
        whiteSpace: 'nowrap',
      },
      '& > button svg': {
        marginRight: 0,
      },
    }),
    tabItemDragging: css({
      opacity: 0.5,
    }),
    closeButton: css({
      alignSelf: 'center',
      marginLeft: theme.spacing(-0.5),
      marginRight: theme.spacing(0.5),
    }),
    updatedDot: css({
      display: 'inline-block',
      width: theme.spacing(0.75),
      height: theme.spacing(0.75),
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.warning.main,
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flex: 'none',
    }),
  };
};
