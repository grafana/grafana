import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useToggle, useScroll } from 'react-use';

import { type DataSourceApi, type GrafanaTheme2, type TimeRange, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { useStyles2, PanelContainer, ScrollContainer } from '@grafana/ui';

import { SignalExplorer } from '../SignalExplorer/SignalExplorer';

import { type ContentOutlineItemContextProps, useContentOutlineContext } from './ContentOutlineContext';
import { QUERIES_PANEL_ID } from './ContentOutlineItem';
import { ContentOutlineItemButton } from './ContentOutlineItemButton';
import { scrollOutlineItemIntoView } from './scrollIntoView';

function scrollableChildren(item: ContentOutlineItemContextProps) {
  return item.children?.filter((child) => child.type !== 'filter') || [];
}

type SectionsExpanded = Record<string, boolean>;

function shouldBeActive(
  item: ContentOutlineItemContextProps,
  activeSectionId: string,
  activeSectionChildId: string | undefined,
  sectionsExpanded: SectionsExpanded
) {
  const isAnActiveParent = activeSectionId === item.id;
  const isAnActiveChild = activeSectionChildId === item.id;
  const isCollapsed = !sectionsExpanded[item.id];
  const containsScrollableChildren = scrollableChildren(item).length > 0;
  const anyChildActive = isChildActive(item, activeSectionChildId) && !sectionsExpanded[item.id];

  if (containsScrollableChildren) {
    return isCollapsed && (isAnActiveParent || anyChildActive);
  } else {
    return isAnActiveParent || isAnActiveChild;
  }
}

export const CONTENT_OUTLINE_LOCAL_STORAGE_KEYS = {
  visible: 'grafana.explore.contentOutline.visible',
  expanded: 'grafana.explore.contentOutline.expanded',
};

export function ContentOutline({
  scroller,
  panelId,
  showSignalExplorer = false,
  queries = [],
  paneDatasource,
  timeRange,
}: {
  scroller: HTMLElement | undefined;
  panelId: string;
  showSignalExplorer?: boolean;
  queries?: DataQuery[];
  paneDatasource?: DataSourceApi | null;
  /**
   * The pane's range, which scopes every lookup the signal explorer makes. Required, unlike
   * `queries`: an empty query list is a legal input to the explorer, an absent range is not, and
   * `signalExplorerVisible` already widens this panel on the assumption it can render.
   */
  timeRange: TimeRange;
}) {
  const [contentOutlineExpanded, toggleContentOutlineExpanded] = useToggle(
    store.getBool(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.expanded, true)
  );
  const metricsSidebarEnabled = useBooleanFlagValue('grafana.exploreMetricsSidebar', false, {
    suspendUntilReady: false,
    suspendWhileReconciling: false,
  });
  const signalExplorerVisible = metricsSidebarEnabled && showSignalExplorer && contentOutlineExpanded;
  const styles = useStyles2(getStyles, contentOutlineExpanded, signalExplorerVisible);
  const scrollerRef = useRef(scroller || null);
  const { y: verticalScroll } = useScroll(scrollerRef);
  const { outlineItems } = useContentOutlineContext() ?? { outlineItems: [] };
  const [activeSectionId, setActiveSectionId] = useState(outlineItems[0]?.id);
  const [activeSectionChildId, setActiveSectionChildId] = useState(outlineItems[0]?.children?.[0]?.id);

  // The signal explorer lists the same query rows in its own Queries section, so the outline's
  // copy would be a second list of the same refIds. Filtered on render only: the signal explorer
  // resolves a card to its query row through this item's registered children.
  const visibleOutlineItems = signalExplorerVisible
    ? outlineItems.filter((item) => item.panelId !== QUERIES_PANEL_ID)
    : outlineItems;

  // Indentation exists to align rows against the chevrons and the nesting of an expanded outline.
  // An icon-only rail has neither, and padding there only pushes the icons off centre.
  const outlineItemsShouldIndent =
    contentOutlineExpanded &&
    visibleOutlineItems.some(
      (item) => item.children && !(item.mergeSingleChild && item.children?.length === 1) && item.children.length > 0
    );

  const outlineItemsHaveDeleteButton = visibleOutlineItems.some((item) =>
    item.children?.some((child) => child.onRemove)
  );

  const [sectionsExpanded, setSectionsExpanded] = useState(() => {
    return outlineItems.reduce((acc: { [key: string]: boolean }, item) => {
      acc[item.id] = !!item.expanded;
      return acc;
    }, {});
  });

  // Icon-only mode has no label to save space on, so sections render open and lose the collapse
  // affordance — a lone chevron next to an icon reads as nothing at all. `sectionsExpanded` is
  // left untouched so the user's choice is still there when the outline is expanded again.
  const effectiveSectionsExpanded: SectionsExpanded = contentOutlineExpanded
    ? sectionsExpanded
    : Object.fromEntries(visibleOutlineItems.map((item) => [item.id, true]));

  const handleItemClicked = (item: ContentOutlineItemContextProps) => {
    if (item.level === 'child' && item.type === 'filter') {
      const activeParent = outlineItems.find((parent) => {
        return parent.children?.find((child) => child.id === item.id);
      });

      if (activeParent) {
        scrollOutlineItemIntoView(scroller, activeParent.ref, activeParent.customTopOffset);
      }
    } else {
      scrollOutlineItemIntoView(scroller, item.ref, item.customTopOffset);
      reportInteraction('explore_toolbar_contentoutline_clicked', {
        item: 'select_section',
        type: item.panelId,
      });
    }
  };

  const toggle = () => {
    store.set(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.expanded, !contentOutlineExpanded);
    toggleContentOutlineExpanded();
    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'outline',
      type: contentOutlineExpanded ? 'minimize' : 'expand',
    });
  };

  const toggleSection = (itemId: string) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'section',
      type: !sectionsExpanded[itemId] ? 'minimize' : 'expand',
    });
  };

  useEffect(() => {
    let activeItem;

    for (const item of outlineItems) {
      let top = item?.ref?.getBoundingClientRect().top;

      // Check item
      if (top && top >= 0) {
        activeItem = item;
      }

      // Check children
      const activeChild = scrollableChildren(item).find((child) => {
        const offsetTop = child.customTopOffset || 0;
        let childTop = child?.ref?.getBoundingClientRect().top;
        return childTop && childTop >= offsetTop;
      });

      if (activeChild && isCollapsible(item)) {
        setActiveSectionChildId(activeChild.id);
        setActiveSectionId(item.id);
        break;
      }

      if (activeItem) {
        setActiveSectionId(activeItem.id);
        setActiveSectionChildId(undefined);
        break;
      }
    }
  }, [outlineItems, verticalScroll]);

  const toggleButton = (
    <ContentOutlineItemButton
      icon={'arrow-from-right'}
      tooltip={
        contentOutlineExpanded
          ? t('explore.content-outline.tooltip-collapse-outline', 'Collapse outline')
          : t('explore.content-outline.tooltip-expand-outline', 'Expand outline')
      }
      tooltipPlacement={contentOutlineExpanded ? 'right' : 'bottom'}
      onClick={toggle}
      className={cx(styles.toggleContentOutlineButton, {
        [styles.justifyCenter]: !contentOutlineExpanded,
      })}
      aria-expanded={contentOutlineExpanded}
    />
  );

  return (
    <PanelContainer className={styles.wrapper} id={panelId}>
      {signalExplorerVisible && (
        <SignalExplorer
          queries={queries}
          paneDatasource={paneDatasource}
          timeRange={timeRange}
          scroller={scroller}
          toggleButton={toggleButton}
        />
      )}

      <div className={styles.outlineSection}>
        <ScrollContainer>
          <div className={styles.content}>
            {!signalExplorerVisible && toggleButton}
            {visibleOutlineItems.map((item) => {
              const childrenRendered = isCollapsible(item) && effectiveSectionsExpanded[item.id];
              // Children carry the section's own icon while the outline is icon-only, so a section
              // row there is an unlabelled duplicate of the row right below it. Let the children
              // stand for the section instead — every one of them scrolls back into it.
              const sectionRowRendered = contentOutlineExpanded || !childrenRendered;

              return (
                <Fragment key={item.id}>
                  {sectionRowRendered && (
                    <ContentOutlineItemButton
                      key={item.id}
                      title={contentOutlineExpanded ? item.title : undefined}
                      contentOutlineExpanded={contentOutlineExpanded}
                      className={cx(styles.buttonStyles, {
                        [styles.justifyCenter]: !contentOutlineExpanded && !outlineItemsHaveDeleteButton,
                        [styles.sectionHighlighter]:
                          isChildActive(item, activeSectionChildId) && !contentOutlineExpanded,
                      })}
                      indentStyle={cx({
                        [styles.indentRoot]: !isCollapsible(item) && outlineItemsShouldIndent,
                      })}
                      icon={item.icon}
                      onClick={() => handleItemClicked(item)}
                      tooltip={item.title}
                      collapsible={isCollapsible(item) && contentOutlineExpanded}
                      collapsed={!effectiveSectionsExpanded[item.id]}
                      toggleCollapsed={() => toggleSection(item.id)}
                      isActive={shouldBeActive(item, activeSectionId, activeSectionChildId, effectiveSectionsExpanded)}
                      sectionId={item.id}
                      color={item.color}
                    />
                  )}
                  <div id={item.id} data-testid={`section-wrapper-${item.id}`}>
                    {childrenRendered &&
                      item.children?.map((child, i) => (
                        <div key={child.id} className={styles.itemWrapper}>
                          {contentOutlineExpanded && (
                            <div
                              className={cx(styles.itemConnector, {
                                [styles.firstItemConnector]: i === 0,
                                [styles.lastItemConnector]: i === (item.children?.length || 0) - 1,
                              })}
                            />
                          )}
                          <ContentOutlineItemButton
                            key={child.id}
                            title={contentOutlineExpanded ? child.title : undefined}
                            contentOutlineExpanded={contentOutlineExpanded}
                            icon={contentOutlineExpanded ? undefined : item.icon}
                            className={cx(styles.buttonStyles, {
                              [styles.justifyCenter]: !contentOutlineExpanded && !outlineItemsHaveDeleteButton,
                              [styles.sectionHighlighter]:
                                isChildActive(item, activeSectionChildId) && !contentOutlineExpanded,
                            })}
                            indentStyle={styles.indentChild}
                            onClick={(e) => {
                              handleItemClicked(child);
                              child.onClick?.(e);
                            }}
                            tooltip={child.title}
                            isActive={shouldBeActive(
                              child,
                              activeSectionId,
                              activeSectionChildId,
                              effectiveSectionsExpanded
                            )}
                            extraHighlight={child.highlight}
                            color={child.color}
                            onRemove={child.onRemove ? () => child.onRemove?.(child.id) : undefined}
                          />
                        </div>
                      ))}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </ScrollContainer>
      </div>
    </PanelContainer>
  );
}

const getStyles = (theme: GrafanaTheme2, expanded: boolean, signalExplorerVisible: boolean) => {
  const expandedWidth = signalExplorerVisible ? '300px' : '160px';

  return {
    wrapper: css({
      label: 'wrapper',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      marginRight: theme.spacing(1),
      height: '100%',
      overflow: 'hidden',
      backgroundColor: theme.colors.background.primary,
      width: expanded ? expandedWidth : undefined,
      minWidth: expanded ? expandedWidth : undefined,
    }),
    outlineSection: css({
      label: 'outline-section',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      ...(signalExplorerVisible
        ? {
            // Shrinkable so a tall outline scrolls (via ScrollContainer) instead of
            // clipping against the wrapper, while still sizing to content and sitting
            // at the bottom.
            flex: '0 1 auto',
            marginTop: 'auto',
            borderTop: `1px solid ${theme.colors.border.weak}`,
          }
        : {
            flex: '1 1 auto',
          }),
    }),
    content: css({
      label: 'content',
      padding: theme.spacing(0, 0.5),
      top: 0,
    }),
    buttonStyles: css({
      display: 'flex',
      '&:hover': {
        color: theme.colors.text.primary,
        textDecoration: 'underline',
      },
    }),
    toggleContentOutlineButton: css({
      '&:hover': {
        color: theme.colors.text.primary,
      },
      transform: expanded ? 'rotate(180deg)' : '',
      marginRight: expanded ? theme.spacing(0.5) : undefined,
    }),
    indentRoot: css({
      paddingLeft: theme.spacing(3),
    }),
    indentChild: css({
      paddingLeft: expanded ? theme.spacing(5) : 0,
    }),
    itemWrapper: css({
      display: 'flex',
      height: theme.spacing(4),
      alignItems: 'center',
    }),
    itemConnector: css({
      position: 'relative',
      height: '100%',
      width: theme.spacing(1.5),
      '&::before': {
        borderRight: `1px solid ${theme.colors.border.medium}`,
        content: '""',
        height: '100%',
        left: theme.spacing(4.75),
        position: 'absolute',
        transform: 'translateX(50%)',
      },
    }),
    firstItemConnector: css({
      '&::before': {
        top: theme.spacing(1),
        height: `calc(100% - ${theme.spacing(1)})`,
      },
    }),
    lastItemConnector: css({
      '&::before': {
        height: `calc(100% - ${theme.spacing(1)})`,
      },
    }),
    justifyCenter: css({
      justifyContent: 'center',
    }),
    sectionHighlighter: css({
      backgroundColor: theme.colors.background.secondary,
    }),
  };
};

function isCollapsible(item: ContentOutlineItemContextProps): boolean {
  return !!(item.children && item.children.length > 0 && (!item.mergeSingleChild || item.children.length !== 1));
}

function isChildActive(item: ContentOutlineItemContextProps, activeSectionChildId: string | undefined) {
  return item.children?.some((child) => child.id === activeSectionChildId);
}
