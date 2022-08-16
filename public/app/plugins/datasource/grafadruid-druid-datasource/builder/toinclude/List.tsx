import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';

export const List = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, List);
  return (
    <Row>
      <Multiple
        {...scopedProps('columns')}
        label="Columns"
        description="The columns names"
        component={Input}
        componentExtraProps={{
          label: 'Column',
          description: 'The column name',
          type: 'text',
        }}
      />
    </Row>
  );
};
List.type = 'list';
List.fields = ['columns'];
