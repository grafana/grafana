import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui/';

import { useDatasource } from '../utils/useDatasource';
import { QueryTemplateRow } from '../utils/view';

export function TitleCell(props: CellProps<QueryTemplateRow>) {
  const datasource = props.row.original.queryTemplate?.targets[0]?.datasource;
  const { datasourceApi } = useDatasource(datasource);

  const styles = useStyles2(getStyles);

  if (props.row.original.queryTemplate?.targets.length === 0) {
    return <div>No queries</div>;
  }
  const firstQuery = props.row.original.queryTemplate?.targets[0]!;

  return (
    <>
      <p className={styles.header}>
        <img
          className={styles.logo}
          src={datasourceApi?.meta.info.logos.small || 'public/img/icn-datasource.svg'}
          alt={datasourceApi?.meta.info.description}
        />
        {datasourceApi?.name}
      </p>
      <p className={styles.query}>{datasourceApi?.getQueryDisplayText?.(firstQuery)}</p>
      <p className={styles.title}>{props.row.original.queryTemplate?.title}</p>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    marginRight: theme.spacing(2),
    width: '16px',
  }),
  header: css({
    margin: 0,
    fontSize: theme.typography.h5.fontSize,
    color: theme.colors.text.secondary,
  }),
  query: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
  }),
  title: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
  }),
});
