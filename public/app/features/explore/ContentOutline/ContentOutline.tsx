import { css, cx } from '@emotion/css';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useToggle, useScroll } from 'react-use';

import { GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, PanelContainer, ScrollContainer } from '@grafana/ui';

import { ContentOutlineItemContextProps, useContentOutlineContext } from './ContentOutlineContext';
import { ContentOutlineItemButton } from './ContentOutlineItemButton';

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
  autoCollapse: 'grafana.explore.contentOutline.autoCollapse', // New key for auto-collapse preference
};

export function ContentOutline({ scroller, panelId }: { scroller: HTMLElement | undefined; panelId: string }) {
  const [contentOutlineExpanded, toggleContentOutlineExpanded] = useToggle(
    store.getBool(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.expanded, true)
  );
  const styles = useStyles2(getStyles, contentOutlineExpanded);
  const scrollerRef = useRef(scroller || null);
  const { y: verticalScroll } = useScroll(scrollerRef);
  const { outlineItems } = useContentOutlineContext() ?? { outlineItems: [] };
  const [activeSectionId, setActiveSectionId] = useState(outlineItems[0]?.id);
  const [activeSectionChildId, setActiveSectionChildId] = useState(outlineItems[0]?.children?.[0]?.id);

  // New state for auto-collapse feature
  const [shouldAutoCollapse, setShouldAutoCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const outlineItemsShouldIndent = outlineItems.some(
    (item) => item.children && !(item.mergeSingleChild && item.children?.length === 1) && item.children.length > 0
  );

  const outlineItemsHaveDeleteButton = outlineItems.some((item) => item.children?.some((child) => child.onRemove));

  const [sectionsExpanded, setSectionsExpanded] = useState(() => {
    return outlineItems.reduce((acc: { [key: string]: boolean }, item) => {
      acc[item.id] = !!item.expanded;
      return acc;
    }, {});
  });

  // Check if content height is less than viewport height for auto-collapse
  useEffect(() => {
    const checkContentHeight = () => {
      if (contentRef.current && scroller && isInitialized && outlineItems.length > 0) {
        const contentHeight = contentRef.current.scrollHeight;
        const viewportHeight = scroller.clientHeight;
        
        // Only auto-collapse if user hasn't manually expanded/collapsed recently
        const autoCollapsePreference = store.getBool(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.autoCollapse, true);
        setShouldAutoCollapse(contentHeight < viewportHeight && autoCollapsePreference);
      }
    };

    // Wait for content to be rendered before checking
    if (!isInitialized && outlineItems.length > 0 && scroller && contentRef.current) {
      // Use requestAnimationFrame to ensure DOM has been painted
      requestAnimationFrame(() => {
        setIsInitialized(true);
      });
    }

    // Check on mount and when outline items change
    if (isInitialized) {
      checkContentHeight();
    }
    
    // Also check when window resizes
    window.addEventListener('resize', checkContentHeight);
    
    // Set up a MutationObserver to watch for content changes
    const observer = new MutationObserver(checkContentHeight);
    if (scroller && isInitialized) {
      observer.observe(scroller, { childList: true, subtree: true });
    }
    
    return () => {
      window.removeEventListener('resize', checkContentHeight);
      observer.disconnect();
    };
  }, [outlineItems, scroller, isInitialized]);

  const scrollIntoView = (ref: HTMLElement | null, customOffsetTop = 0) => {
    let scrollValue = 0;
    let el: HTMLElement | null | undefined = ref;

    if (!el) {
      return;
    }

    do {
      scrollValue += el?.offsetTop || 0;
      el = el?.offsetParent instanceof HTMLElement ? el.offsetParent : undefined;
    } while (el && el !== scroller);

    scroller?.scroll({
      top: scrollValue + customOffsetTop,
      behavior: 'smooth',
    });
  };

  const handleItemClicked = (item: ContentOutlineItemContextProps) => {
    if (item.level === 'child' && item.type === 'filter') {
      const activeParent = outlineItems.find((parent) => {
        return parent.children?.find((child) => child.id === item.id);
      });

      if (activeParent) {
        scrollIntoView(activeParent.ref, activeParent.customTopOffset);
      }
    } else {
      scrollIntoView(item.ref, item.customTopOffset);
      reportInteraction('explore_toolbar_contentoutline_clicked', {
        item: 'select_section',
        type: item.panelId,
      });
    }
  };

  const toggle = () => {
    store.set(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.expanded, !contentOutlineExpanded);
    // When user manually toggles, disable auto-collapse until page reload
    store.set(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.autoCollapse, false);
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

  // Determine if the content outline should be expanded
  const isExpanded = shouldAutoCollapse ? false : contentOutlineExpanded;

  return (
    <PanelContainer className={styles.wrapper} id={panelId}>
      <ScrollContainer>
        <div ref={contentRef} className={styles.content}>
          <ContentOutlineItemButton
            icon={'arrow-from-right'}
            tooltip={
              isExpanded
                ? t('explore.content-outline.tooltip-collapse-outline', 'Collapse outline')
                : t('explore.content-outline.tooltip-expand-outline', 'Expand outline')
            }
            tooltipPlacement={isExpanded ? 'right' : 'bottom'}
            onClick={toggle}
            className={cx(styles.toggleContentOutlineButton, {
              [styles.justifyCenter]: !isExpanded && !outlineItemsShouldIndent,
            })}
            aria-expanded={isExpanded}
          />

          {outlineItems.map((item) => {
            return (
              <Fragment key={item.id}>
                <ContentOutlineItemButton
                  key={item.id}
                  title={isExpanded ? item.title : undefined}
                  contentOutlineExpanded={isExpanded}
                  className={cx(styles.buttonStyles, {
                    [styles.justifyCenter]: !isExpanded && !outlineItemsHaveDeleteButton,
                    [styles.sectionHighlighter]: isChildActive(item, activeSectionChildId) && !isExpanded,
                  })}
                  indentStyle={cx({
                    [styles.indentRoot]: !isCollapsible(item) && outlineItemsShouldIndent,
                    [styles.sectionHighlighter]:
                      isChildActive(item, activeSectionChildId) && !isExpanded && sectionsExpanded[item.id],
                  })}
                  icon={item.icon}
                  onClick={() => handleItemClicked(item)}
                  tooltip={item.title}
                  collapsible={isCollapsible(item)}
                  collapsed={!sectionsExpanded[item.id]}
                  toggleCollapsed={() => toggleSection(item.id)}
                  isActive={shouldBeActive(item, activeSectionId, activeSectionChildId, sectionsExpanded)}
                  sectionId={item.id}
                  color={item.color}
                />
                <div id={item.id} data-testid={`section-wrapper-${item.id}`}>
                  {item.children &&
                    isCollapsible(item) &&
                    sectionsExpanded[item.id] &&
                    item.children.map((child, i) => (
                      <div key={child.id} className={styles.itemWrapper}>
                        {isExpanded && (
                          <div
                            className={cx(styles.itemConnector, {
                              [styles.firstItemConnector]: i === 0,
                              [styles.lastItemConnector]: i === (item.children?.length || 0) - 1,
                            })}
                          />
                        )}
                        <ContentOutlineItemButton
                          key={child.id}
                          title={isExpanded ? child.title : undefined}
                          contentOutlineExpanded={isExpanded}
                          icon={isExpanded ? undefined : item.icon}
                          className={cx(styles.buttonStyles, {
                            [styles.justifyCenter]: !isExpanded && !outlineItemsHaveDeleteButton,
                            [styles.sectionHighlighter]:
                              isChildActive(item, activeSectionChildId) && !isExpanded,
                          })}
                          indentStyle={styles.indentChild}
                          onClick={(e) => {
                            handleItemClicked(child);
                            child.onClick?.(e);
                          }}
                          tooltip={child.title}
                          isActive={shouldBeActive(child, activeSectionId, activeSectionChildId, sectionsExpanded)}
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
    </PanelContainer>
  );
}

// ... existing styles and helper functions remain the same ...
const getStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  return {
    wrapper: css({
      label: 'wrapper',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      marginRight: theme.spacing(1),
      height: '100%',
      backgroundColor: theme.colors.background.primary,
      width: expanded ? '160px' : undefined,
      minWidth: expanded ? '160px' : undefined,
    }),
    content: css({
      label: 'content',
      marginLeft: theme.spacing(0.5),
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
      paddingLeft: expanded ? theme.spacing(5) : theme.spacing(2.75),
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