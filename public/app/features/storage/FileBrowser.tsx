import { css } from '@emotion/css';
import { dataFrameFromJSON, DataFrameJSON, GrafanaTheme2, LoadingState } from '@grafana/data';
import { getBackendSrv, PanelRenderer } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';
import { uniqueId } from 'lodash';
import React from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

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
              const v = frame.fields[0].values.get(row);
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
      <ul className={styles.breadCrumb}>
        {parts.map((part, index) => {
          let url = '/' + parts.slice(0, index + 1).join('/');
          if (index === 0) {
            url = part;
          }
          return (
            <li
              key={uniqueId(part)}
              onClick={() => {
                // Don't change path if it's the last part
                if (index === parts.length - 1) {
                  return;
                }
                onPathChange(url);
              }}
            >
              {part}
            </li>
          );
        })}
      </ul>

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
    breadCrumb: css`
      list-style: none;
      padding: ${theme.spacing(2, 1)};

      li {
        display: inline;

        :not(:last-child) {
          color: ${theme.colors.text.link};
          cursor: pointer;

          + li:before {
            content: '>';
            padding: ${theme.spacing(1)};
            color: ${theme.colors.text.secondary};
          }
        }
      }
    `,
  };
}
