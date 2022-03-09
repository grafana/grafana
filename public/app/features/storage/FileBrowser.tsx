import { css } from '@emotion/css';
import { dataFrameFromJSON, DataFrameJSON, GrafanaTheme2, LoadingState } from '@grafana/data';
import { getBackendSrv, PanelRenderer } from '@grafana/runtime';
import { IconName, Spinner, useStyles2 } from '@grafana/ui';
import AutoSizer from 'react-virtualized-auto-sizer';
import React from 'react';
import { useAsync } from 'react-use';
import { RootStorageMeta } from './types';

interface Props {
  prefix: string;
  path: string; // ideally path in URL!
  onPathChange: (path: string) => void;
}

export function FileBrowser({ path, prefix, onPathChange }: Props) {
  const styles = useStyles2(getStyles);
  const parts = path.split('/');

  const folder = useAsync(async () => {
    const rsp = (await getBackendSrv().get(`api/storage/path/${prefix}/${path}`)) as DataFrameJSON;
    if (rsp && rsp.data) {
      const frame = dataFrameFromJSON(rsp);
      const name = frame.fields[0];
      name.config.links = [
        {
          title: 'Link',
          url: '',
          onClick: (evt) => {
            const row = evt.origin.rowIndex;
            if (row != null) {
              const v = name.values.get(row);
              if (v) {
                onPathChange(`${path}/${v}`);
              }
            }
          },
        },
      ];
      return frame;
    }
    return undefined;
  }, [prefix, path]);

  return (
    <>
      <pre>NAV: {JSON.stringify(parts)}</pre>

      <div className={styles.wrap}>
        <AutoSizer disableHeight style={{ width: '100%' }}>
          {({ width }) => {
            if (width === 0) {
              return null;
            }
            return (
              <>
                {folder.loading && <Spinner />}
                {folder.value && (
                  <PanelRenderer
                    pluginId="table"
                    title="Folder"
                    data={{ series: [folder.value], state: LoadingState.Done } as any}
                    options={{}}
                    width={width - 2}
                    height={400}
                    fieldConfig={{ defaults: {}, overrides: [] }}
                    timeZone="browser"
                  />
                )}
              </>
            );
          }}
        </AutoSizer>
      </div>
    </>
  );
}
function getStyles(theme: GrafanaTheme2) {
  return {
    wrap: css`
      width: 100%;
    `,
  };
}

export function getIconName(type: string): IconName {
  switch (type) {
    case 'git':
      return 'code-branch';
    case 'disk':
      return 'folder-open';
    case 'sql':
      return 'database';
    default:
      return 'folder-open';
  }
}
export function getDescription(storage: RootStorageMeta) {
  if (storage.config.disk) {
    return `${storage.config.disk.path}`;
  }
  if (storage.config.git) {
    return `${storage.config.git.remote}`;
  }
  if (storage.config.sql) {
    return `${storage.config.sql}`;
  }
  return '';
}
