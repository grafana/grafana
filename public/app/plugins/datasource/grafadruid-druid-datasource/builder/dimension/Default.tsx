import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Select, Row } from '../abstract';

export const Default = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Default);
  return (
    <Row>
      <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
      <Input
        {...scopedProps('outputName')}
        label="Output name"
        description="The, optionnal, dimension output name"
        type="text"
      />
      <Select
        {...scopedProps('outputType')}
        label="Output type"
        description="The output type"
        entries={{ STRING: 'String', LONG: 'Long', FLOAT: 'Float' }}
      />
    </Row>
  );
};
Default.type = 'default';
Default.fields = ['dimension', 'outputName', 'outputType'];
