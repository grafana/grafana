import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable, type DropResult, type DragStart } from '@hello-pangea/dnd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { canScrollLeft, canScrollRight, scrollBy } = useScrollOverflow(scrollContainerRef, tabs.length);

  useEffect(() => {
    if (currentTab && currentTab.getSlug() !== model.state.currentTabSlug) {
      model.setState({ currentTabSlug: currentTab.getSlug() });
    }
  }, [currentTab, model]);

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
                    ref={mergeRefs(dropProvided.innerRef, scrollContainerRef)}
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

const getStyles = (theme: GrafanaTheme2) => ({
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
    paddingInline: theme.spacing(0.125),
    paddingTop: '1px',
  }),
  // Fade the tabs themselves to transparent near the overflow edges using a mask.
  // This avoids painting any color over whatever sits behind the tab bar (canvas,
  // custom backgrounds, etc.) so the chevron buttons appear to float above the tabs.
  // The region behind the chevron (spacing(4) ≈ 32px) is fully transparent; the
  // remaining spacing(2) ≈ 16px is a soft fade into the visible tabs.
  tabsContainerFadeLeft: css({
    maskImage: `linear-gradient(to right, transparent 0, transparent ${theme.spacing(4)}, black ${theme.spacing(6)})`,
    WebkitMaskImage: `linear-gradient(to right, transparent 0, transparent ${theme.spacing(4)}, black ${theme.spacing(6)})`,
  }),
  tabsContainerFadeRight: css({
    maskImage: `linear-gradient(to left, transparent 0, transparent ${theme.spacing(4)}, black ${theme.spacing(6)})`,
    WebkitMaskImage: `linear-gradient(to left, transparent 0, transparent ${theme.spacing(4)}, black ${theme.spacing(6)})`,
  }),
  tabsContainerFadeBoth: css({
    maskImage: `linear-gradient(to right, transparent 0, transparent ${theme.spacing(4)}, black ${theme.spacing(6)}, black calc(100% - ${theme.spacing(6)}), transparent calc(100% - ${theme.spacing(4)}), transparent 100%)`,
    WebkitMaskImage: `linear-gradient(to right, transparent 0, transparent ${theme.spacing(4)}, black ${theme.spacing(6)}, black calc(100% - ${theme.spacing(6)}), transparent calc(100% - ${theme.spacing(4)}), transparent 100%)`,
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
});

function mergeRefs<T>(
  ...refs: Array<React.RefCallback<T> | React.MutableRefObject<T | null> | undefined>
): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }
      if (typeof ref === 'function') {
        ref(value);
      } else {
        ref.current = value;
      }
    }
  };
}

const SCROLL_TOLERANCE_PX = 1;

function useScrollOverflow(elementRef: React.RefObject<HTMLElement | null>, depValue: number) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return;
    }

    const update = () => {
      const hasLeft = el.scrollLeft > SCROLL_TOLERANCE_PX;
      const hasRight = el.scrollLeft + el.clientWidth < el.scrollWidth - SCROLL_TOLERANCE_PX;
      setCanScrollLeft(hasLeft);
      setCanScrollRight(hasRight);
    };

    update();

    el.addEventListener('scroll', update, { passive: true });

    // Observe the scroll container itself (window resize) and its direct children
    // (tab title edits, add/remove) so overflow state stays accurate without manual polling.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) {
      if (child instanceof Element) {
        observer.observe(child);
      }
    }

    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [elementRef, depValue]);

  const scrollBy = useCallback(
    (direction: 'left' | 'right') => {
      const el = elementRef.current;
      if (!el) {
        return;
      }
      const delta = el.clientWidth * 0.8;
      el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' });
    },
    [elementRef]
  );

  return { canScrollLeft, canScrollRight, scrollBy };
}
