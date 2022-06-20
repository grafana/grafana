import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, useStyles2 } from '@grafana/ui';

import { TOP_BAR_LEVEL_HEIGHT } from './types';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.searchBar}>
      <Input prefix={<Icon name="search" />} width={50} type="text" />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    searchBar: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'flex',
      padding: theme.spacing(0, 2),
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
