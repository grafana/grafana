import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';

export const Contains = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Contains);
  return (
    <>
      <Row>
        <Input {...scopedProps('value')} label="Value" description="the value that has to be contained" type="text" />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('case_sensitive')}
          label="Case sensitive"
          description="Specifies if the match should be case sensitive"
        />
      </Row>
    </>
  );
};
Contains.type = 'contains';
Contains.fields = ['case_sensitive', 'value'];
