import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';

export const Union = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Union);
  return (
    <Row>
      <Multiple
        {...scopedProps('dataSources')}
        label="Datasources"
        description="Datasources to union"
        component={Input}
        componentExtraProps={{
          label: 'Datasource',
          description: 'The datasource name',
          type: 'text',
        }}
      />
    </Row>
  );
};
Union.type = 'union';
Union.fields = ['dataSources'];
