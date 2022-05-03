import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useStyles2 } from '@grafana/ui';

export const NoData = () => {
  const css = useStyles2(getStyles);
  return (
    <>
      <div data-testid="explore-no-data" className={cx([css.wrapper, 'panel-container'])}>
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
    font-size: ${theme.typography.h2.fontSize};
    padding: ${theme.spacing(4)};
    color: ${theme.colors.text.disabled};
  `,
});
