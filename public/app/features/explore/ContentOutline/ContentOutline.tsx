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
      height: '100%',
      backgroundColor: theme.colors.background.primary,
      marginRight: theme.spacing(1),
      zIndex: theme.zIndex.sidemenu,
    }),
    content: css({
      label: 'content',
      position: 'sticky',
      top: 0,
      height: '85vh',
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
    reportInteraction('grafana_explore_content_outline_item_clicked', {
      scrollButtonClicked: buttonTitle,
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <ToolbarButton
          className={styles.buttonStyles}
          icon={expanded ? 'angle-left' : 'angle-right'}
          onClick={toggleExpanded}
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
