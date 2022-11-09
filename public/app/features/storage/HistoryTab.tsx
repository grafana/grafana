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
    return getGrafanaStorage().history(info.object.GRN);
  }, [path]);

  return (
    <div className={styles.tableWrapper}>
      <pre>{JSON.stringify(history?.value, null, 2)}</pre>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css`
    border: 1px solid ${theme.colors.border.medium};
  `,
});
