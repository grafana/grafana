import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, ToolbarButton } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    label: 'content',
    marginLeft: theme.spacing(1),
    width: '3em',
    position: 'sticky',
    backgroundColor: theme.colors.background.primary,
    transition: 'width 10s',
  }),
});

const scrollIntoView = (ref: string) => {
  const el = document.getElementById(ref);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const ContentOutline = () => {
  const style = useStyles2(getStyles);
  return (
    <div className={style.content}>
      <h1>co</h1>
      <ToolbarButton icon="code-branch" onClick={() => scrollIntoView('node-graph')} />
    </div>
  );
};

export default ContentOutline;
