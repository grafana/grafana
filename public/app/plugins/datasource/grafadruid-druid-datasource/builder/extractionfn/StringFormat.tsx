import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Select, Row } from '../abstract';

export const StringFormat = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, StringFormat);
  return (
    <Row>
      <Input {...scopedProps('format')} label="Format" description="The sprintf expression" type="text" />
      <Select
        {...scopedProps('nullHandling')}
        label="Null handling"
        description="How to handle null value"
        entries={{ NULLSTRING: 'Null string', EMPTYSTRING: 'Empty string', RETURNNULL: 'Return null' }}
      />
    </Row>
  );
};
StringFormat.type = 'stringFormat';
StringFormat.fields = ['format', 'nullHandling'];
