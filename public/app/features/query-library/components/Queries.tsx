import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { useStyles2 } from '@grafana/ui/src';

import QueryLibrarySearchTable from './QueryLibrarySearchTable';

export const Queries = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.tableWrapper}>
      <QueryLibrarySearchTable />
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableWrapper: css`
      height: 100%;
    `,
  };
};
