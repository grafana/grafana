import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, ToolbarButton } from '@grafana/ui';

import { useContentOutlineContext } from './ContentOutlineContext';

const getStyles = (theme: GrafanaTheme2, expanded: boolean, visible: boolean) => {
  return {
    content: css({
      label: 'content',
      display: 'flex',
      flexDirection: 'column',
      marginRight: expanded ? theme.spacing(-3) : theme.spacing(1),
      width: expanded ? 'auto' : '3em',
      position: 'sticky',
      top: 0,
      height: '99vh',
      backgroundColor: theme.colors.background.primary,
      transition: 'width 0.5s, visibility 0.5s',
      visibility: visible ? 'visible' : 'hidden',
      zIndex: 2,
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
  const style = useStyles2((theme) => getStyles(theme, expanded, visible));
  const { outlineItems } = useContentOutlineContext();

  const scrollIntoView = (ref: HTMLElement | null) => {
    ref?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={style.content}>
      <ToolbarButton
        className={style.buttonStyles}
        icon={expanded ? 'angle-left' : 'angle-right'}
        onClick={toggleExpanded}
      >
        {expanded && 'Hide Content Outline'}
      </ToolbarButton>
      {outlineItems.map((item) => (
        <ToolbarButton
          key={item.id}
          className={style.buttonStyles}
          icon={item.icon}
          onClick={() => scrollIntoView(item.ref)}
        >
          {expanded && item.title}
        </ToolbarButton>
      ))}
    </div>
  );
};

export default ContentOutline;
