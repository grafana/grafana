import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, ToolbarButton } from '@grafana/ui';

import { useContentOutlineContext } from './ContentOutlineContext';

const getStyles = (theme: GrafanaTheme2, expanded: boolean, visible: boolean) => {
  return {
    wrapper: css({
      label: 'wrapper',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      height: '100%',
      backgroundColor: theme.colors.background.primary,
      marginRight: expanded ? theme.spacing(-3) : theme.spacing(1),
      width: expanded ? 'auto' : '3em',
      transition: 'width 2.5s, visibility 2.5s',
      visibility: visible ? 'visible' : 'hidden',
      zIndex: 2,
    }),
    content: css({
      label: 'content',
      position: 'sticky',
      top: 0,
      height: '85vh',
    }),
    buttonStyles: css({
      textAlign: 'left',
    }),
  };
};

interface ContentOutlineProps {
  visible: boolean;
}

const ContentOutline = ({ visible }: ContentOutlineProps) => {
  const [expanded, toggleExpanded] = useToggle(false);
  const styles = useStyles2((theme) => getStyles(theme, expanded, visible));
  const { outlineItems } = useContentOutlineContext();

  const scrollIntoView = (ref: HTMLElement | null) => {
    ref?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <ToolbarButton
          className={styles.buttonStyles}
          icon={expanded ? 'angle-left' : 'angle-right'}
          onClick={toggleExpanded}
        >
          {expanded && 'Hide Content Outline'}
        </ToolbarButton>
        {outlineItems.map((item) => (
          <ToolbarButton
            key={item.id}
            className={styles.buttonStyles}
            icon={item.icon}
            onClick={() => scrollIntoView(item.ref)}
          >
            {expanded && item.title}
          </ToolbarButton>
        ))}
      </div>
    </div>
  );
};

export default ContentOutline;
