import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, Row } from '../abstract';
import { DataSource } from '../datasource';

export const DatasourceMetadata = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderProps(props, DatasourceMetadata);
  return (
    <Row>
      <DataSource {...scopedProps('dataSource')} />
    </Row>
  );
};
DatasourceMetadata.queryType = 'dataSourceMetadata';
DatasourceMetadata.fields = ['dataSource'];
