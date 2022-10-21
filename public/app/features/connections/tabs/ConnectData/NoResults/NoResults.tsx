import { css } from '@emotion/css';
import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

const getStyles = () => ({
  noResults: css`
    text-align: center;
    padding: 50px 0;
    font-style: italic;
  `,
});

export const NoResults: FC = () => {
  const styles = useStyles2(getStyles);

  return <p className={styles.noResults}>No results matching your query were found.</p>;
};
