import React from 'react';
import { css, cx } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';

import { GrafanaTheme2 } from '@grafana/data/src';

export const NoData = () => {
  const css = useStyles2(getStyles);
  return (
    <>
      <div className={cx([css.wrapper, 'panel-container'])}>
        <span className={cx([css.message])}>{'No data'}</span>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    label: no-data-card;
    padding: ${theme.spacing(3)};
    background: ${theme.colors.background.primary};
    border-radius: ${theme.shape.borderRadius(2)};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-grow: 1;
  `,
  message: css`
    margin-bottom: ${theme.spacing(3)};
    font-size: 2em;
    padding: 6em 1em;
    color: ${theme.colors.text.disabled};
  `,
});
