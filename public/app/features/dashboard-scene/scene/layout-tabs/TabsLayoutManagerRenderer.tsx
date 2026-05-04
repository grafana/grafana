import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable, type DropResult, type DragStart } from '@hello-pangea/dnd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { MultiValueVariable, type SceneComponentProps, sceneGraph, useSceneObjectState } from '@grafana/scenes';
import { Button, IconButton, TabsBar, useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getDashboardSceneFor, getLayoutOrchestratorFor } from '../../utils/utils';
import { useSoloPanelContext } from '../SoloPanelContext';
import { dashboardCanvasAddButtonHoverStyles, getLayoutControlsStyles } from '../layouts-shared/styles';
import { useClipboardState } from '../layouts-shared/useClipboardState';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../types/DashboardDropTarget';

import { TabItem } from './TabItem';
import { TabItemLayoutRenderer } from './TabItemRenderer';
import { TabItemRepeater } from './TabItemRepeater';
import { type TabsLayoutManager } from './TabsLayoutManager';

export function TabsLayoutManagerRenderer({ model }: SceneComponentProps<TabsLayoutManager>) {
  const styles = useStyles2(getStyles);
  const layoutControlsStyles = useStyles2(getLayoutControlsStyles);

  const { tabs, key, placeholder, isDropTarget } = model.useState();
  const currentTab = model.getCurrentTab();
  const dashboard = getDashboardSceneFor(model);
  const orchestrator = getLayoutOrchestratorFor(model);
  const { isEditing } = dashboard.useState();
  const { hasCopiedTab } = useClipboardState();
  const isNestedInTab = useMemo(() => model.parent instanceof TabItem, [model.parent]);
  const soloPanelContext = useSoloPanelContext();

  const { scrollRef, scrollEl, canScrollLeft, canScrollRight, scrollBy } = useHorizontalOverflow();

  useEffect(() => {
    if (currentTab && currentTab.getSlug() !== model.state.currentTabSlug) {
      model.setState({ currentTabSlug: currentTab.getSlug() });
    }
  }, [currentTab, model]);

  // Ensure the active tab is visible on switch, reorder, and append.
  // Append scrolls to the end (no measurement needed); all other cases measure the tab's position.
  useEffect(() => {
    if (!scrollEl) {
      return;
    }

    let rafId: number;

    const callback = () => {
      const tabEl = currentTab?.containerRef.current;
      if (tabEl) {
        scrollTabIntoView(scrollEl, tabEl);
      } else {
        rafId = requestAnimationFrame(callback);
      }
    };

    rafId = requestAnimationFrame(callback);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [currentTab, scrollEl, tabs]);

  if (soloPanelContext) {
    return tabs.map((tab) => <TabWrapper tab={tab} manager={model} key={tab.state.key!} />);
  }

  const isClone = isRepeatCloneOrChildOf(model);

  const onBeforeDragStart = (start: DragStart) => {
    const sourceTabsManagerId = start.source.droppableId;
    const draggedTabId = start.draggableId;
    orchestrator?.startTabDrag(sourceTabsManagerId, draggedTabId);
  };

  const onDragEnd = (result: DropResult) => {
    const targetIndex = result.destination?.index;
    orchestrator?.stopTabDrag(targetIndex);
  };

  let placeholderComponent: React.ReactNode | null = null;

  const children: React.ReactNode[] = tabs.map((tab) => <TabWrapper tab={tab} manager={model} key={tab.state.key!} />);

  if (isDropTarget && placeholder) {
    placeholderComponent = (
      <div key="placeholder" style={{ width: placeholder.width, height: placeholder.height }}></div>
    );
    children.splice(placeholder.index, 0, placeholderComponent);
  }

  return (
    <div className={cx(styles.tabLayoutContainer, { [styles.nestedTabsMargin]: isNestedInTab })}>
      <TabsBar className={styles.tabsBar}>
        <DragDropContext onBeforeDragStart={onBeforeDragStart} onDragEnd={onDragEnd}>
          <div className={styles.tabsRow} {...{ [DASHBOARD_DROP_TARGET_KEY_ATTR]: key }}>
            <div className={styles.tabsScrollArea}>
              <Droppable droppableId={key!} direction="horizontal">
                {(dropProvided) => (
                  <div
                    className={cx(styles.tabsContainer, {
                      [styles.tabsContainerFadeLeft]: canScrollLeft && !canScrollRight,
                      [styles.tabsContainerFadeRight]: !canScrollLeft && canScrollRight,
                      [styles.tabsContainerFadeBoth]: canScrollLeft && canScrollRight,
                    })}
                    ref={(node) => {
                      dropProvided.innerRef(node);
                      scrollRef(node);
                    }}
                    {...dropProvided.droppableProps}
                  >
                    {children}

                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
              {canScrollLeft && (
                <div className={cx(styles.scrollButtonWrapper, styles.scrollButtonWrapperLeft)}>
                  <IconButton
                    className={styles.scrollButton}
                    name="angle-left"
                    size="md"
                    variant="secondary"
                    aria-label={t('dashboard.tabs-layout.scroll-tabs-left', 'Scroll tabs left')}
                    onClick={() => scrollBy('left')}
                    onMouseDown={(evt) => evt.preventDefault()}
                    onPointerDown={(evt) => evt.stopPropagation()}
                  />
                </div>
              )}
              {canScrollRight && (
                <div className={cx(styles.scrollButtonWrapper, styles.scrollButtonWrapperRight)}>
                  <IconButton
                    className={styles.scrollButton}
                    name="angle-right"
                    size="md"
                    variant="secondary"
                    aria-label={t('dashboard.tabs-layout.scroll-tabs-right', 'Scroll tabs right')}
                    onClick={() => scrollBy('right')}
                    onMouseDown={(evt) => evt.preventDefault()}
                    onPointerDown={(evt) => evt.stopPropagation()}
                  />
                </div>
              )}
            </div>
            {isEditing && !isClone && (
              <div className={cx(styles.tabControls, layoutControlsStyles.controls, 'dashboard-canvas-controls')}>
                <Button
                  icon="plus"
                  variant="secondary"
                  size="sm"
                  onClick={() => model.addNewTab()}
                  onPointerUp={(evt) => evt.stopPropagation()}
                  onPointerDown={(evt) => evt.stopPropagation()}
                  data-testid={selectors.components.CanvasGridAddActions.addTab}
                >
                  <Trans i18nKey="dashboard.canvas-actions.new-tab">New tab</Trans>
                </Button>
                {hasCopiedTab && (
                  <Button
                    icon="clipboard-alt"
                    variant="secondary"
                    size="sm"
                    onClick={() => model.pasteTab()}
                    onPointerUp={(evt) => evt.stopPropagation()}
                    onPointerDown={(evt) => evt.stopPropagation()}
                    data-testid={selectors.components.CanvasGridAddActions.pasteTab}
                  >
                    <Trans i18nKey="dashboard.canvas-actions.paste-tab">Paste tab</Trans>
                  </Button>
                )}
                <Button
                  icon="layers-slash"
                  variant="secondary"
                  size="sm"
                  onClick={() => model.ungroupTabs()}
                  data-testid={selectors.components.CanvasGridAddActions.ungroup}
                >
                  <Trans i18nKey="dashboard.canvas-actions.ungroup-tabs">Ungroup tabs</Trans>
                </Button>
              </div>
            )}
          </div>
        </DragDropContext>
      </TabsBar>

      {currentTab && <TabItemLayoutRenderer tab={currentTab} isEditing={isEditing} />}
    </div>
  );
}

function TabWrapper({ tab, manager }: { tab: TabItem; manager: TabsLayoutManager }) {
  const { repeatByVariable } = useSceneObjectState(tab, { shouldActivateOrKeepAlive: true });

  if (repeatByVariable) {
    const variable = sceneGraph.lookupVariable(repeatByVariable, manager);

    if (variable instanceof MultiValueVariable) {
      return <TabItemRepeater tab={tab} key={tab.state.key!} manager={manager} variable={variable} />;
    }
  }
  return <tab.Component model={tab} key={tab.state.key!} />;
}

const getStyles = (theme: GrafanaTheme2) => {
  // Single source of truth for the fade inset. Used in both scroll-padding
  // (read back by scrollTabIntoView via getComputedStyle) and mask-image.
  const fadeInset = theme.spacing(6);

  return {
    tabLayoutContainer: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
    }),
    tabsBar: css({
      ...dashboardCanvasAddButtonHoverStyles,
    }),
    tabsRow: css({
      display: 'flex',
      width: '100%',
      alignItems: 'center',
    }),
    tabsScrollArea: css({
      position: 'relative',
      flex: '1 1 auto',
      minWidth: 0,
      display: 'flex',
    }),
    tabsContainer: css({
      display: 'flex',
      flex: '1 1 auto',
      minWidth: 0,
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
      scrollPaddingInline: fadeInset,
      paddingInline: theme.spacing(0.125),
      paddingTop: '1px',
    }),
    tabsContainerFadeLeft: css({
      maskImage: `linear-gradient(to right, transparent 0, transparent ${theme.spacing(4)}, black ${fadeInset})`,
    }),
    tabsContainerFadeRight: css({
      maskImage: `linear-gradient(to left, transparent 0, transparent ${theme.spacing(4)}, black ${fadeInset})`,
    }),
    tabsContainerFadeBoth: css({
      maskImage: `linear-gradient(to right, transparent 0, transparent ${theme.spacing(4)}, black ${fadeInset}, black calc(100% - ${fadeInset}), transparent calc(100% - ${theme.spacing(4)}), transparent 100%)`,
    }),
    scrollButtonWrapper: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      zIndex: 1,
      pointerEvents: 'none',
    }),
    scrollButtonWrapperLeft: css({
      left: 0,
    }),
    scrollButtonWrapperRight: css({
      right: 0,
    }),
    scrollButton: css({
      pointerEvents: 'auto',
    }),
    tabControls: css({
      marginLeft: theme.spacing(1),
    }),
    nestedTabsMargin: css({
      marginLeft: theme.spacing(2),
    }),
  };
};

const SCROLL_TOLERANCE_PX = 1;

/**
 * Tracks horizontal overflow state of an element, exposing whether scroll
 * buttons should be shown and a callback to scroll by roughly one viewport.
 *
 * Uses MutationObserver on childList so it catches repeated tabs, DnD
 * placeholders, and any other child DOM mutation — no manual dependency needed.
 */
function useHorizontalOverflow() {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRef = useCallback((node: HTMLElement | null) => setScrollEl(node), []);

  useEffect(() => {
    if (!scrollEl) {
      return;
    }

    const update = () => {
      setCanScrollLeft(scrollEl.scrollLeft > SCROLL_TOLERANCE_PX);
      setCanScrollRight(scrollEl.scrollLeft + scrollEl.clientWidth < scrollEl.scrollWidth - SCROLL_TOLERANCE_PX);
    };

    update();

    scrollEl.addEventListener('scroll', update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);

    const mo = new MutationObserver(update);
    mo.observe(scrollEl, { childList: true });

    return () => {
      scrollEl.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scrollEl]);

  const scrollBy = useCallback(
    (direction: 'left' | 'right') => {
      if (!scrollEl) {
        return;
      }
      const delta = scrollEl.clientWidth * 0.8;
      scrollEl.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' });
    },
    [scrollEl]
  );

  return { scrollRef, scrollEl, canScrollLeft, canScrollRight, scrollBy };
}

/**
 * Scrolls `container` so `tab` is fully visible outside the fade region.
 * Reads the fade inset from the element's own CSS `scroll-padding-inline`
 * so there is no JS constant to keep in sync with the mask-image gradient.
 */
function scrollTabIntoView(container: HTMLElement, tab: HTMLElement) {
  const cs = getComputedStyle(container);
  const padStart = parseFloat(cs.scrollPaddingInlineStart) || 0;
  const padEnd = parseFloat(cs.scrollPaddingInlineEnd) || 0;

  const cRect = container.getBoundingClientRect();
  const tRect = tab.getBoundingClientRect();

  const tabL = tRect.left - cRect.left + container.scrollLeft;
  const tabR = tabL + tRect.width;

  const viewL = container.scrollLeft + padStart;
  const viewR = container.scrollLeft + container.clientWidth - padEnd;

  if (tabL >= viewL && tabR <= viewR) {
    return;
  }

  let target = container.scrollLeft;
  if (tabL < viewL) {
    target = tabL - padStart;
  } else {
    target = tabR - container.clientWidth + padEnd;
  }

  const max = container.scrollWidth - container.clientWidth;
  container.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: 'smooth' });
}
