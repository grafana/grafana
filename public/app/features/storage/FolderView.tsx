import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Tab, Table, TabsBar, useStyles2 } from '@grafana/ui';

import { StorageView } from './types';

interface Props {
  listing: DataFrame;
  path: string;
  onPathChange: (p: string) => void;
  view: StorageView;
  setView: (v: StorageView) => void;
}

export function FolderView({ listing, path, onPathChange, view, setView }: Props) {
  const styles = useStyles2(getStyles);
  const opts = [
    { what: StorageView.Data, text: 'Data' },
    { what: StorageView.Config, text: 'Configure' },
    { what: StorageView.Perms, text: 'Permissions' },
  ];

  if (path.startsWith('resources')) {
    opts.push({
      what: StorageView.Upload,
      text: 'Upload',
    });
  }

  const renderBody = () => {
    switch (view) {
      case StorageView.Config:
        return <div>CONFIGURE?</div>;
      case StorageView.Perms:
        return <div>Permissions</div>;
      case StorageView.Upload:
        return <div>UPLOAD!</div>;
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
  };

  return (
    <>
      <TabsBar>
        {opts.map((opt) => {
          return (
            <Tab key={opt.what} label={opt.text} active={opt.what === view} onChangeTab={() => setView(opt.what)} />
          );
        })}
      </TabsBar>
      {renderBody()}
    </>
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
