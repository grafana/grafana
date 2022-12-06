import { css } from '@emotion/css';
import React, { FC, useState } from 'react';
import { useDebounce } from 'react-use';

import { Icon, Input, useStyles2 } from '@grafana/ui';

const getStyles = () => ({
  searchContainer: css`
    display: flex;
    margin: 16px 0;
    justify-content: space-between;
  `,
});

export const Search: FC<{ onChange: (searchTerm: string) => void }> = ({ onChange }) => {
  const styles = useStyles2(getStyles);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useDebounce(
    () => {
      onChange(searchTerm);
    },
    200,
    [searchTerm]
  );

  return (
    <div className={styles.searchContainer}>
      <Input
        onChange={(e) => setSearchTerm(e.currentTarget.value)}
        prefix={<Icon name="search" />}
        placeholder="Search all"
        aria-label="Search all"
      />
    </div>
  );
};
