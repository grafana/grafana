import { cx } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { useDatasource } from '../utils/useDatasource';
import { QueryTemplateRow } from '../utils/view';

import { useQueryLibraryListStyles } from './styles';

export function TitleCell(props: CellProps<QueryTemplateRow>) {
  const datasource = props.row.original.queryTemplate?.targets[0]?.datasource;
  const { datasourceApi } = useDatasource(datasource);

  const styles = useQueryLibraryListStyles();

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
      <p className={cx(styles.mainText, styles.singleLine)}>{datasourceApi?.getQueryDisplayText?.(firstQuery)}</p>
      <p className={cx(styles.otherText, styles.singleLine)}>{props.row.original.queryTemplate?.title}</p>
    </>
  );
}
