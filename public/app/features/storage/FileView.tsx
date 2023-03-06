import { css } from '@emotion/css';
import { isString } from 'lodash';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, useStyles2 } from '@grafana/ui';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';

import { getGrafanaStorage } from './storage';
import { StorageView } from './types';

interface FileDisplayInfo {
  category?: 'svg' | 'image' | 'text';
  language?: string; // match code editor
}

interface Props {
  listing: DataFrame;
  path: string;
  onPathChange: (p: string, view?: StorageView) => void;
  view: StorageView;
}

export function FileView({ listing, path, onPathChange, view }: Props) {
  const styles = useStyles2(getStyles);
  const info = useMemo(() => getFileDisplayInfo(path), [path]);
  const body = useAsync(async () => {
    if (info.category === 'text') {
      const rsp = await getGrafanaStorage().get(path);
      if (isString(rsp)) {
        return rsp;
      }
      return JSON.stringify(rsp, null, 2);
    }
    return null;
  }, [info, path]);

  switch (view) {
    case StorageView.Config:
      return <div>CONFIGURE?</div>;
    case StorageView.Perms:
      return <div>Permissions</div>;
    case StorageView.History:
      return <div>TODO... history</div>;
  }

  let src = `api/storage/read/${path}`;
  if (src.endsWith('/')) {
    src = src.substring(0, src.length - 1);
  }

  switch (info.category) {
    case 'svg':
      return (
        <div>
          <SanitizedSVG src={src} className={styles.icon} />
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
      return (
        <div className={styles.tableWrapper}>
          <AutoSizer>
            {({ width, height }) => (
              <CodeEditor
                width={width}
                height={height}
                value={body.value ?? ''}
                showLineNumbers={false}
                readOnly={true}
                language={info.language ?? 'text'}
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
