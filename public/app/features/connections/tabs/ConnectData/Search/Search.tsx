import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

const getStyles = (theme: GrafanaTheme2) => ({
  searchContainer: css({
    display: 'flex',
    justifyContent: 'space-between',

    position: 'sticky',
    top: 0,
    backgroundColor: theme.colors.background.primary,
    zIndex: 2,
    padding: theme.spacing(2, 0),
  }),
});

const placeholder = t('connections.search.placeholder', 'Search all');

export interface Props {
  onChange: (e: React.FormEvent<HTMLInputElement>) => void;
  value: string | undefined;
}

export const Search = ({ onChange, value }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.searchContainer}>
      <Input
        value={value}
        onChange={onChange}
        prefix={<Icon name="search" />}
        placeholder={placeholder}
        aria-label="Search all"
      />
    </div>
  );
};
