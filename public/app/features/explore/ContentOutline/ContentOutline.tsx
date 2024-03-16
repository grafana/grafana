import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useToggle, useScroll } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, PanelContainer, CustomScrollbar } from '@grafana/ui';

import { ContentOutlineItemContextProps, useContentOutlineContext } from './ContentOutlineContext';
import { ContentOutlineItemButton } from './ContentOutlineItemButton';

export function ContentOutline({ scroller, panelId }: { scroller: HTMLElement | undefined; panelId: string }) {
  const [contentOutlineExpanded, toggleContentOutlineExpanded] = useToggle(false);
  const styles = useStyles2(getStyles, contentOutlineExpanded);
  const [sectionExpanded, toggleSectionExpanded] = useToggle(false);
  const scrollerRef = useRef(scroller || null);
  const { y: verticalScroll } = useScroll(scrollerRef);
  const { outlineItems } = useContentOutlineContext() ?? { outlineItems: [] };
  const [activeSectionId, setActiveSectionId] = useState(outlineItems[0]?.id);
  const [activeSectionChildId, setActiveSectionChildId] = useState(outlineItems[0]?.children?.[0]?.id);

  const outlineItemsShouldIndent = outlineItems.some(
    (item) => item.children && !(item.mergeSingleChild && item.children?.length === 1) && item.children.length > 0
  );

  const scrollIntoView = (ref: HTMLElement | null, itemPanelId: string, customOffsetTop = 0) => {
    let scrollValue = 0;
    let el: HTMLElement | null | undefined = ref;

    do {
      scrollValue += el?.offsetTop || 0;
      el = el?.offsetParent as HTMLElement;
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

  const toggleSection = () => {
    toggleSectionExpanded();
    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'section',
      type: sectionExpanded ? 'minimize' : 'expand',
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
      const activeChild = item.children?.find((child) => {
        const offsetTop = child.customTopOffset || 0;
        let childTop = child?.ref?.getBoundingClientRect().top;
        return childTop && childTop >= offsetTop;
      });

      if (activeChild) {
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
  }, [outlineItems, verticalScroll, sectionExpanded]);

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
            width={contentOutlineExpanded ? 160 : 40}
          />

          {outlineItems.map((item) => (
            <React.Fragment key={item.id}>
              <ContentOutlineItemButton
                key={item.id}
                title={contentOutlineExpanded ? item.title : undefined}
                className={cx(styles.buttonStyles, {
                  [styles.indentRoot]: outlineItemsShouldIndent && item.children?.length === 0,
                  [styles.justifyCenter]: !contentOutlineExpanded,
                })}
                icon={item.icon}
                onClick={() => scrollIntoView(item.ref, item.panelId)}
                tooltip={!contentOutlineExpanded ? item.title : undefined}
                collapsible={isCollapsible(item)}
                collapsed={!sectionExpanded}
                toggleCollapsed={toggleSection}
                isActive={activeSectionId === item.id}
                width={getRootWidth(contentOutlineExpanded, isCollapsible(item))}
              />
              {item.children &&
                (!item.mergeSingleChild || item.children.length !== 1) &&
                sectionExpanded &&
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
                      icon={contentOutlineExpanded ? undefined : item.icon}
                      className={cx(styles.buttonStyles, styles.indentChildren, {
                        [styles.justifyCenter]: !contentOutlineExpanded,
                      })}
                      onClick={() => scrollIntoView(child.ref, child.panelId, child.customTopOffset)}
                      tooltip={!contentOutlineExpanded ? child.title : undefined}
                      isActive={activeSectionChildId === child.id}
                      width={contentOutlineExpanded ? 88 : 40}
                    />
                  </div>
                ))}
            </React.Fragment>
          ))}
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
      marginLeft: theme.spacing(4),
    }),
    indentChildren: css({
      marginLeft: expanded ? theme.spacing(8.25) : theme.spacing(4),
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
  };
};

function isCollapsible(item: ContentOutlineItemContextProps): boolean {
  return !!(item.children && item.children.length > 0 && (!item.mergeSingleChild || item.children.length !== 1));
}

function getRootWidth(contentOutlineExpanded: boolean, isCollapsible: boolean): number {
  let width = 40;

  if (contentOutlineExpanded && isCollapsible) {
    width = 122;
  } else if (contentOutlineExpanded) {
    width = 160;
  }

  return width;
}
