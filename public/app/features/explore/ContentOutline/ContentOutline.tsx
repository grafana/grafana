import { css } from '@emotion/css';
import React from 'react';
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
  const [expanded, toggleExpanded] = useToggle(false);
  const styles = useStyles2((theme) => getStyles(theme));
  const { outlineItems } = useContentOutlineContext();

  const scrollIntoView = (ref: HTMLElement | null, itemPanelId: string) => {
    let scrollValue = 0;
    let el: HTMLElement | null | undefined = ref;

    // This is to handle ContentOutlineItem wrapping each QueryEditorRow
    const customOffsetTop = itemPanelId === 'Queries' ? -10 : 0;

    do {
      scrollValue += el?.offsetTop || customOffsetTop;
      el = el?.offsetParent as HTMLElement;
    } while (el && el !== scroller);

    scroller?.scroll({
      top: scrollValue,
      behavior: 'smooth',
    });
    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'select_section',
      type: itemPanelId,
    });
  };

  const toggle = () => {
    toggleExpanded();
    reportInteraction('explore_toolbar_contentoutline_clicked', {
      item: 'outline',
      type: expanded ? 'minimize' : 'expand',
    });
  };

  console.log('outlineItems', outlineItems);

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

          {/* TODO: implement a collapsible section if item has children
           */}
          {outlineItems.map((item) => (
            <>
              <ContentOutlineItemButton
                key={item.id}
                title={expanded ? item.title : undefined}
                className={styles.buttonStyles}
                icon={item.icon}
                onClick={() => scrollIntoView(item.ref, item.panelId)}
                tooltip={!expanded ? item.title : undefined}
              />
              {item.children?.map((child) => (
                <ContentOutlineItemButton
                  key={child.id}
                  title={expanded ? child.title : undefined}
                  className={styles.buttonStyles}
                  icon={child.icon}
                  onClick={() => scrollIntoView(child.ref, child.panelId)}
                  tooltip={!expanded ? child.title : undefined}
                />
              ))}
            </>
          ))}
        </div>
      </CustomScrollbar>
    </PanelContainer>
  );
}
