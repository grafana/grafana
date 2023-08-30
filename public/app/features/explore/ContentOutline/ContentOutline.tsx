import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, ToolbarButton } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2, expanded: boolean, visible: boolean) => {
  return {
    content: css({
      label: 'content',
      display: 'flex',
      flexDirection: 'column',
      marginRight: expanded ? theme.spacing(-3) : theme.spacing(1),
      width: expanded ? 'auto' : '3em',
      top: 0,
      right: 0,
      backgroundColor: theme.colors.background.primary,
      transition: 'width 0.5s, visibility 0.5s',
      visibility: visible ? 'visible' : 'hidden',
      zIndex: 2,
      overflow: 'visible',
    }),
    buttonStyles: css({
      textAlign: 'left',
    }),
  };
};

interface ContentOutlineProps {
  // items: ItemProps[],
  visible: boolean;
}

interface ItemProps {
  title: string;
  icon: string;
  scrollRef: string;
}

const scrollIntoView = (ref: string) => {
  const el = document.getElementById(ref);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// TODO: haris - scrollRef should have paneId + panel title = this should be implemented
// at the level of each panel, e.g. TableContainer, NodeGraphContainer etc.

const items = [
  {
    title: 'Prometheus',
    icon: 'gf-prometheus-2',
    scrollRef: 'prometheus',
  },
  {
    title: 'Table',
    icon: 'table',
    scrollRef: 'table',
  },
  {
    title: 'Logs',
    icon: 'gf-logs',
    scrollRef: 'logs',
  },
  {
    title: 'Node Graph',
    icon: 'code-branch',
    scrollRef: 'node-graph',
  },
  {
    title: 'Graph',
    icon: 'graph-bar',
    scrollRef: 'graph',
  },
  {
    title: 'Traces',
    icon: 'gf-traces-2',
    scrollRef: 'traces',
  },
];

const ContentOutline = ({ visible }: ContentOutlineProps) => {
  const [expanded, toggleExpanded] = useToggle(false);
  const style = useStyles2((theme) => getStyles(theme, expanded, visible));

  console.log('contentOutlineVisible', visible);

  return (
    <div className={style.content}>
      {/* TODO: haris - this will be rendered by maping items from an array
      will have icon, title, and scrollRef
      */}
      <ToolbarButton
        className={style.buttonStyles}
        icon={expanded ? 'angle-left' : 'angle-right'}
        onClick={toggleExpanded}
      >
        {expanded && 'Hide Content Outline'}
      </ToolbarButton>
      {items.map((item: ItemProps) => (
        <ToolbarButton
          key={item.title}
          className={style.buttonStyles}
          icon={item.icon}
          onClick={() => scrollIntoView(item.scrollRef)}
        >
          {expanded && item.title}
        </ToolbarButton>
      ))}
    </div>
  );
};

export default ContentOutline;
