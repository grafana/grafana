import { useCallback, useState } from 'react';
import { css } from '@emotion/css';

import { applyQueryDefaults, SqlDatasource }from '@grafana/sql';
import { GrafanaTheme2, LogRowModel, TimeRange } from '@grafana/data';
import {  useStyles2 } from '@grafana/ui';

import { SQLQuery, QueryRowFilter } from '../../types';
import { haveColumns } from '../../utils/sql.utils';
import { RawEditor } from '../query-editor-raw/RawEditor';

export interface SimpleLogContextUiProps {
  sqlDataSource: SqlDatasource;
  cachedSql: SQLQuery[];
  row: LogRowModel;
  orignQuery: SQLQuery;
  runContextQuery?: () => void;
  onContextClose: () => void;
  range?: TimeRange;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      width: '100%',
      height: '70%',
    }),
  };
}


export function SimpleLogContextUi(props: SimpleLogContextUiProps) {
  const { sqlDataSource, orignQuery, range, cachedSql, runContextQuery } = props;
  const styles = useStyles2(getStyles);
  const queryWithDefaults = applyQueryDefaults(orignQuery);
  const [queryRowFilter, setQueryRowFilter] = useState<QueryRowFilter>({
    filter: !!queryWithDefaults.sql?.whereString,
    group: !!queryWithDefaults.sql?.groupBy?.[0]?.property.name,
    order: !!queryWithDefaults.sql?.orderBy?.property.name,
    preview: true,
  });
  const [queryToValidate, setQueryToValidate] = useState(queryWithDefaults);

  const isQueryValid = (q: SQLQuery) => {
    return Boolean(q.rawSql);
  };

  const processQuery = useCallback(
    (q: SQLQuery) => {
      if (isQueryValid(q) && runContextQuery) {
        cachedSql.splice(0, cachedSql.length);
        cachedSql.push(q);
        runContextQuery();
      }
    },
    [runContextQuery]
  );

  // 定义 onChange 函数
  const onChange = (query: SQLQuery, process: boolean) => {
    setQueryToValidate(query);
    //onChange(query);

    if (haveColumns(query.sql?.columns) && query.sql?.columns.some((c) => c.name) && !queryRowFilter.group) {
      setQueryRowFilter({ ...queryRowFilter, group: true });
    }

    if (process) {
      processQuery(query);
    }
  };

  // 定义 onValidate 函数
  const onValidate = (isValid: boolean) => {
    console.log("do nothing of validate");
  };

  return (
    <div className={styles.wrapper}>
      <RawEditor
        db={sqlDataSource.db}
        query={orignQuery}
        queryToValidate={queryToValidate}
        onChange={onChange}
        onRunQuery={() => runContextQuery?.()}
        onValidate={onValidate}
        range={range}
     />
    </div>
  );
}
