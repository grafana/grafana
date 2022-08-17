import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Table, Row } from '../abstract';

export const Inline = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Inline);
  return (
    <Row>
      <Table
        {...scopedProps(undefined)}
        label={undefined}
        description="the inline datasource CSV-like formated. header line should be formated like 'label:string,weight:float'. e.g: 'label:string,weight:float\nexample,10.3'"
        namesFieldName="columnNames"
        typesFieldName="columnTypes"
        rowsFieldName="rows"
      />
    </Row>
  );
};
Inline.type = 'inline';
Inline.fields = ['columnNames', 'columnTypes', 'rows'];
