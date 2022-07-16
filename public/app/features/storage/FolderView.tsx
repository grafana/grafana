import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Table, useStyles2 } from '@grafana/ui';

import { UploadView } from './UploadView';
import { StorageView } from './types';

interface Props {
  listing: DataFrame;
  path: string;
  onPathChange: (p: string, view?: StorageView) => void;
  view: StorageView;
  fileNames: string[];
}

export function FolderView({ listing, path, onPathChange, view, fileNames }: Props) {
  const styles = useStyles2(getStyles);

  switch (view) {
    case StorageView.Config:
      return <div>CONFIGURE?</div>;
    case StorageView.Perms:
      return <div>Permissions</div>;
    case StorageView.Upload:
      return (
        <UploadView
          folder={path}
          onUpload={(rsp) => {
            console.log('Uploaded: ' + path);
            if (rsp.path) {
              onPathChange(rsp.path);
            } else {
              onPathChange(path); // back to data
            }
          }}
          fileNames={fileNames}
        />
      );
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
