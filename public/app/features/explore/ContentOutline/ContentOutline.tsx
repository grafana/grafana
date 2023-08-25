import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../../packages/grafana-ui';

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    label: 'content',
    marginLeft: theme.spacing(1),
    width: '3em',
    backgroundColor: theme.colors.background.primary,
    transition: 'width 10s',
  }),
});

const ContentOutline = () => {
  const style = useStyles2(getStyles);
  return (
    <div className={style.content}>
      <h1>co</h1>
    </div>
  );
};

export default ContentOutline;
