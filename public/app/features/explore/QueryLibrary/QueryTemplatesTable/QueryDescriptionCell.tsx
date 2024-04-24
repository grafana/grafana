import { cx } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { Spinner } from '@grafana/ui';

import { useDatasource } from '../utils/useDatasource';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

export function QueryDescriptionCell(props: CellProps<QueryTemplateRow>) {
  const datasourceApi = useDatasource(props.row.original.datasourceRef);
  const styles = useQueryLibraryListStyles();

  if (!datasourceApi) {
    return <Spinner />;
  }

  if (!props.row.original.query) {
    return <div>No queries</div>;
  }
  const query = props.row.original.query;

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
      <p className={cx(styles.mainText, styles.singleLine)}>{datasourceApi?.getQueryDisplayText?.(query)}</p>
      <p className={cx(styles.otherText, styles.singleLine)}>{props.row.original.description}</p>
    </>
  );
}
