import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Table, useStyles2 } from '@grafana/ui';

import { StorageView } from './types';

interface Props {
  listing: DataFrame;
  view: StorageView;
}

export function FolderView({ listing, view }: Props) {
  const styles = useStyles2(getStyles);

  switch (view) {
    case StorageView.Config:
      return <div>CONFIGURE?</div>;
    case StorageView.Perms:
      return <div>Permissions</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <AutoSizer>
        {({ width, height }) => (
          <div style={{ width: `${width}px`, height: `${height}px` }}>
            <Table
              height={height}
              width={width}
              data={listing}
              noHeader={false}
              showTypeIcons={false}
              resizable={false}
            />
          </div>
        )}
      </AutoSizer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // TODO: remove `height: 90%`
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  tableControlRowWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: ${theme.spacing(2)};
  `,
  // TODO: remove `height: 100%`
  tableWrapper: css`
    border: 1px solid ${theme.colors.border.medium};
    height: 100%;
  `,
  uploadSpot: css`
    margin-left: ${theme.spacing(2)};
  `,
  border: css`
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
});
