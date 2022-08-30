import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import OpenTsDatasource from '../datasource';
import { OpenTsdbOptions, OpenTsdbQuery } from '../types';

export type OpenTsdbQueryEditorProps = QueryEditorProps<OpenTsDatasource, OpenTsdbQuery, OpenTsdbOptions>;

export function OpenTsdbQueryEditor({
  datasource,
  onRunQuery,
  onChange,
  query,
  range,
  queries,
}: OpenTsdbQueryEditorProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.visualEditor}>Query Editor</div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
    `,
    visualEditor: css`
      flex-grow: 1;
    `,
    toggleButton: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
}
