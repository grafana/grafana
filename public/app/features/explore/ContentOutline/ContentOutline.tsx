import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, ToolbarButton } from '@grafana/ui';

import { useContentOutlineContext } from './ContentOutlineContext';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'wrapper',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      marginRight: theme.spacing(1),
      zIndex: theme.zIndex.sidemenu,
    }),
    content: css({
      label: 'content',
      backgroundColor: theme.colors.background.primary,
      position: 'sticky',
      top: '56px',
      height: '81vh',
    }),
    buttonStyles: css({
      textAlign: 'left',
      width: '100%',
    }),
  };
};

const ContentOutline = () => {
  const [expanded, toggleExpanded] = useToggle(false);
  const styles = useStyles2((theme) => getStyles(theme));
  const { outlineItems } = useContentOutlineContext();

  const scrollIntoView = (ref: HTMLElement | null, buttonTitle: string) => {
    ref?.scrollIntoView({ behavior: 'smooth' });
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <ToolbarButton
          className={styles.buttonStyles}
          icon={expanded ? 'angle-left' : 'angle-right'}
          onClick={toggle}
          tooltip={!expanded ? 'Show Content Outline' : undefined}
        >
          {expanded && 'Hide Content Outline'}
        </ToolbarButton>
        {outlineItems.map((item) => (
          <ToolbarButton
            key={item.id}
            className={styles.buttonStyles}
            icon={item.icon}
            onClick={() => scrollIntoView(item.ref, item.title)}
            tooltip={!expanded ? item.title : undefined}
          >
            {expanded && item.title}
          </ToolbarButton>
        ))}
      </div>
    </div>
  );
};

export default ContentOutline;
