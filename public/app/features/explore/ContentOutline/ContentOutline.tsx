import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useToggle, useScroll } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, PanelContainer, CustomScrollbar } from '@grafana/ui';

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

export function ContentOutline({ scroller, panelId }: { scroller: HTMLElement | undefined; panelId: string }) {
  const [contentOutlineExpanded, toggleContentOutlineExpanded] = useToggle(false);
  const styles = useStyles2(getStyles, contentOutlineExpanded);
  const scrollerRef = useRef(scroller || null);
  const { y: verticalScroll } = useScroll(scrollerRef);
  const { outlineItems } = useContentOutlineContext() ?? { outlineItems: [] };
  const [activeSectionId, setActiveSectionId] = useState(outlineItems[0]?.id);
  const [activeSectionChildId, setActiveSectionChildId] = useState(outlineItems[0]?.children?.[0]?.id);

  const outlineItemsShouldIndent = outlineItems.some(
    (item) => item.children && !(item.mergeSingleChild && item.children?.length === 1) && item.children.length > 0
  );

  const [sectionsExpanded, setSectionsExpanded] = useState(() => {
    return outlineItems.reduce((acc: { [key: string]: boolean }, item) => {
      acc[item.id] = false;
      return acc;
    }, {});
  });

  const scrollIntoView = (ref: HTMLElement | null, itemPanelId: string, customOffsetTop = 0) => {
    let scrollValue = 0;
    let el: HTMLElement | null | undefined = ref;

    do {
      scrollValue += el?.offsetTop || 0;
      el = el?.offsetParent instanceof HTMLElement ? el.offsetParent : undefined;
    } while (el && el !== scroller);

    scroller?.scroll({
      top: scrollValue + customOffsetTop,
      behavior: 'smooth',
    });

    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'select_section',
      type: itemPanelId,
    });
  };

  const toggle = () => {
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

  const activateFilter = (filterId: string) => {
    const activeParent = outlineItems.find((item) => {
      return item.children?.find((child) => child.id === filterId);
    });

    if (activeParent) {
      scrollIntoView(activeParent.ref, activeParent.panelId, activeParent.customTopOffset);
    }
  };

  return (
    <PanelContainer className={styles.wrapper} id={panelId}>
      <CustomScrollbar>
        <div className={styles.content}>
          <ContentOutlineItemButton
            icon={'arrow-from-right'}
            tooltip={contentOutlineExpanded ? 'Collapse outline' : 'Expand outline'}
            tooltipPlacement={contentOutlineExpanded ? 'right' : 'bottom'}
            onClick={toggle}
            className={cx(styles.toggleContentOutlineButton, {
              [styles.justifyCenter]: !contentOutlineExpanded && !outlineItemsShouldIndent,
            })}
            aria-expanded={contentOutlineExpanded}
          />

          {outlineItems.map((item) => {
            return (
              <React.Fragment key={item.id}>
                <ContentOutlineItemButton
                  key={item.id}
                  title={contentOutlineExpanded ? item.title : undefined}
                  contentOutlineExpanded={contentOutlineExpanded}
                  className={cx(styles.buttonStyles, {
                    [styles.justifyCenter]: !contentOutlineExpanded,
                    [styles.sectionHighlighter]: isChildActive(item, activeSectionChildId) && !contentOutlineExpanded,
                  })}
                  indentStyle={cx({
                    [styles.indentRoot]: !isCollapsible(item) && outlineItemsShouldIndent,
                    [styles.sectionHighlighter]:
                      isChildActive(item, activeSectionChildId) && !contentOutlineExpanded && sectionsExpanded[item.id],
                  })}
                  icon={item.icon}
                  onClick={() => scrollIntoView(item.ref, item.panelId)}
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
                            [styles.justifyCenter]: !contentOutlineExpanded,
                            [styles.sectionHighlighter]:
                              isChildActive(item, activeSectionChildId) && !contentOutlineExpanded,
                          })}
                          indentStyle={styles.indentChild}
                          onClick={(e) => {
                            child.type === 'filter'
                              ? activateFilter(child.id)
                              : scrollIntoView(child.ref, child.panelId, child.customTopOffset);
                            child.onClick?.(e);
                          }}
                          tooltip={child.title}
                          isActive={shouldBeActive(child, activeSectionId, activeSectionChildId, sectionsExpanded)}
                          extraHighlight={child.highlight}
                          color={child.color}
                        />
                      </div>
                    ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </CustomScrollbar>
    </PanelContainer>
  );
}

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
      paddingLeft: theme.spacing(4),
    }),
    indentChild: css({
      paddingLeft: expanded ? theme.spacing(7) : theme.spacing(4),
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
        left: 48,
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
