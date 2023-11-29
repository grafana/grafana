import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useToggle } from 'react-use';

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
    const observer = new IntersectionObserver(
      (entries) => {
        console.log('entries', entries);
        entries.forEach((entry) => {
          console.log('entry', entry);
          if (entry.isIntersecting) {
            const activeItem = outlineItems.find((item) => item.ref === entry.target);
            setActiveItemId(activeItem?.id);
          }
        });
      },
      { root: scroller, threshold: 1 }
    );

    outlineItems.forEach((item) => {
      if (item.ref) {
        observer.observe(item.ref);
      }
    });

    return () => observer.disconnect();
  }, [outlineItems, scroller]);

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

          {outlineItems.map((item) => (
            <ContentOutlineItemButton
              key={item.id}
              title={expanded ? item.title : undefined}
              className={styles.buttonStyles}
              icon={item.icon}
              onClick={() => {
                scrollIntoView(item.ref, item.title);
                setActiveItemId(item.id);
              }}
              tooltip={!expanded ? item.title : undefined}
              isActive={activeItemId === item.id}
            />
          ))}
        </div>
      </CustomScrollbar>
    </PanelContainer>
  );
}
