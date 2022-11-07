import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getGrafanaStorage } from './storage';
import { ObjectInfo } from './types';

interface Props {
  info: ObjectInfo;
  path: string;
}

export function HistoryTab({ info, path }: Props) {
  const styles = useStyles2(getStyles);

  const history = useAsync(() => {
    return getGrafanaStorage().history(path);
  }, [path]);

  return (
    <div className={styles.tableWrapper}>
      <pre>{JSON.stringify(history?.value, null, 2)}</pre>
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
