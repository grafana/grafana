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

export const Search: FC<{ onChange: (e: React.FormEvent<HTMLInputElement>) => void }> = ({ onChange }) => {
  const styles = useStyles2(getStyles);
  const [inputEvent, setInputEvent] = useState<React.FormEvent<HTMLInputElement> | undefined>();

  useDebounce(
    () => {
      if (!inputEvent) {
        return;
      }
      onChange(inputEvent);
    },
    500,
    [inputEvent]
  );

  return (
    <div className={styles.searchContainer}>
      <Input
        onChange={setInputEvent}
        prefix={<Icon name="search" />}
        placeholder="Search all"
        aria-label="Search all"
      />
    </div>
  );
};
