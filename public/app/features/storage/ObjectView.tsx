import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import SVG from 'react-inlinesvg';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, useStyles2 } from '@grafana/ui';

import { ObjectInfo, StorageView } from './types';

interface FileDisplayInfo {
  category?: 'svg' | 'image' | 'text';
  language?: string; // match code editor
}

interface Props {
  info: ObjectInfo;
  path: string;
  onPathChange: (p: string, view?: StorageView) => void;
  view: StorageView;
}

export function ObjectView({ info, path, onPathChange, view }: Props) {
  const styles = useStyles2(getStyles);
  const finfo = useMemo(() => getFileDisplayInfo(path), [path]);

  switch (view) {
    case StorageView.Info: {
      if (info.object.body_base64) {
        delete info.object.body_base64;
      }
      if (info.object.body) {
        delete info.object.body;
      }
      return (
        <div>
          <pre>{JSON.stringify(info, null, 2)}</pre>
        </div>
      );
    }
    case StorageView.Perms:
      return <div>Permissions</div>;
    case StorageView.History:
      return <div>TODO... history</div>;
  }

  let src = `api/object/raw/${path}`;
  if (src.endsWith('/')) {
    src = src.substring(0, src.length - 1);
  }

  switch (finfo.category) {
    case 'svg':
      return (
        <div>
          <SVG src={src} className={styles.icon} />
        </div>
      );
    case 'image':
      return (
        <div>
          <a target={'_self'} href={src}>
            <img src={src} alt="File preview" className={styles.img} />
          </a>
        </div>
      );
    case 'text':
      let body = '';
      if (info.object?.body) {
        body = JSON.stringify(info.object.body, null, 2);
      }
      return (
        <div className={styles.tableWrapper}>
          <AutoSizer>
            {({ width, height }) => (
              <CodeEditor
                width={width}
                height={height}
                value={body}
                showLineNumbers={false}
                readOnly={true}
                language={finfo.language ?? 'text'}
                showMiniMap={false}
                onBlur={(text: string) => {
                  console.log('CHANGED!', text);
                }}
              />
            )}
          </AutoSizer>
        </div>
      );
  }

  return (
    <div>
      FILE: <a href={src}>{path}</a>
    </div>
  );
}

function getFileDisplayInfo(path: string): FileDisplayInfo {
  const idx = path.lastIndexOf('.');
  if (idx < 0) {
    return {};
  }
  const suffix = path.substring(idx + 1).toLowerCase();
  switch (suffix) {
    case 'svg':
      return { category: 'svg' };
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'gif':
      return { category: 'image' };

    case 'geojson':
    case 'json':
      return { category: 'text', language: 'json' };
    case 'text':
    case 'go':
    case 'md':
      return { category: 'text' };
  }
  return {};
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
  img: css`
    max-width: 100%;
    // max-height: 147px;
    // fill: ${theme.colors.text.primary};
  `,
  icon: css`
    // max-width: 100%;
    // max-height: 147px;
    // fill: ${theme.colors.text.primary};
  `,
});
