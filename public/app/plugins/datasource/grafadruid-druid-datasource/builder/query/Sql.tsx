import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Code, Row } from '../abstract';

export const Sql = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Sql);
  return (
    <Row>
      <Code
        {...scopedProps('query')}
        label={undefined}
        description="The SQL query. e.g: SELECT * FROM datasource"
        lang="sql"
      />
    </Row>
  );
};
Sql.queryType = 'sql';
Sql.fields = ['query'];
