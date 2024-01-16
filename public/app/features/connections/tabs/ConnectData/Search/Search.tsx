import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

const getStyles = (theme: GrafanaTheme2) => ({
  searchContainer: css`
    display: flex;
    margin: 16px 0;
    justify-content: space-between;

    position: sticky;
    top: 0;
    background-color: ${theme.colors.background.primary};
    z-index: 2;
    padding: ${theme.spacing(2)};
    margin: 0 -${theme.spacing(2)};
  `,
});

const placeholder = t('connections.search.placeholder', 'Search all');

export const Search: FC<{ onChange: (e: React.FormEvent<HTMLInputElement>) => void }> = ({ onChange }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.searchContainer}>
      <Input onChange={onChange} prefix={<Icon name="search" />} placeholder={placeholder} aria-label="Search all" />
    </div>
  );
};
