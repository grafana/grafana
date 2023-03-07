import { css } from '@emotion/css';
import cx from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useStyles2 } from '@grafana/ui/src';

export const Description = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <p className={styles.description}>Currently, we don’t support template variables or frontend data sources</p>
      <p className={styles.description}>
        We&apos;d love your feedback. To share, please comment on this{' '}
        <a
          href="https://github.com/grafana/grafana/discussions/49253"
          target="_blank"
          rel="noreferrer"
          className={cx('text-link', styles.description)}
        >
          GitHub discussion
        </a>
        .
      </p>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: ${theme.spacing(3)};
  `,
  description: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
  `,
});
