import { css } from '@emotion/css';
import React, { FC } from 'react';

import { Icon, Input, useStyles2 } from '@grafana/ui';

const getStyles = () => ({
  searchContainer: css`
    display: flex;
    margin: 16px 0;
    justify-content: space-between;
  `,
});

export const Search: FC<{ onChange: (e: React.FormEvent<HTMLInputElement>) => void }> = ({ onChange }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.searchContainer}>
      <Input onChange={onChange} prefix={<Icon name="search" />} placeholder="Search all" aria-label="Search all" />
    </div>
  );
};
