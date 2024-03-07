import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useToggle, useScroll } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, PanelContainer, CustomScrollbar } from '@grafana/ui';

import { useContentOutlineContext } from './ContentOutlineContext';
import { ContentOutlineItemButton } from './ContentOutlineItemButton';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'wrapper',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      marginRight: theme.spacing(1),
      height: '100%',
      backgroundColor: theme.colors.background.primary,
    }),
    content: css({
      label: 'content',
      top: 0,
    }),
    buttonStyles: css({
      textAlign: 'left',
      width: '100%',
      padding: theme.spacing(0, 1.5),
    }),
  };
};

export function ContentOutline({ scroller, panelId }: { scroller: HTMLElement | undefined; panelId: string }) {
  const { outlineItems } = useContentOutlineContext();
  const [expanded, toggleExpanded] = useToggle(false);
  const [activeItemId, setActiveItemId] = useState<string | undefined>(outlineItems[0]?.id);
  const styles = useStyles2((theme) => getStyles(theme));
  const scrollerRef = useRef(scroller || null);
  const { y: verticalScroll } = useScroll(scrollerRef);

  const scrollIntoView = (ref: HTMLElement | null, buttonTitle: string) => {
    let scrollValue = 0;
    let el: HTMLElement | null | undefined = ref;

    do {
      scrollValue += el?.offsetTop || 0;
      el = el?.offsetParent as HTMLElement;
    } while (el && el !== scroller);

    scroller?.scroll({
      top: scrollValue,
      behavior: 'smooth',
    });

    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'select_section',
      type: buttonTitle,
    });
  };

  const toggle = () => {
    toggleExpanded();
    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'outline',
      type: expanded ? 'minimize' : 'expand',
    });
  };

  useEffect(() => {
    const activeItem = outlineItems.find((item) => {
      const top = item?.ref?.getBoundingClientRect().top;

      if (!top) {
        return false;
      }

      return top >= 0;
    });

    if (!activeItem) {
      return;
    }

    setActiveItemId(activeItem.id);
  }, [outlineItems, verticalScroll]);

  return (
    <PanelContainer className={styles.wrapper} id={panelId}>
      <CustomScrollbar>
        <div className={styles.content}>
          <ContentOutlineItemButton
            title={expanded ? 'Collapse outline' : undefined}
            icon={expanded ? 'angle-left' : 'angle-right'}
            onClick={toggle}
            tooltip={!expanded ? 'Expand content outline' : undefined}
            className={styles.buttonStyles}
            aria-expanded={expanded}
          />

          {outlineItems.map((item) => {
            return (
              <ContentOutlineItemButton
                key={item.id}
                title={expanded ? item.title : undefined}
                className={styles.buttonStyles}
                icon={item.icon}
                onClick={() => scrollIntoView(item.ref, item.title)}
                tooltip={!expanded ? item.title : undefined}
                isActive={activeItemId === item.id}
              />
            );
          })}
        </div>
      </CustomScrollbar>
    </PanelContainer>
  );
}
