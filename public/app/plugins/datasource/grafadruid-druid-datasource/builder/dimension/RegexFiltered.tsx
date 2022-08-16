import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { Dimension } from '../dimension';

export const RegexFiltered = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, RegexFiltered);
  return (
    <>
      <Row>
        <Dimension {...scopedProps('delegate')} />
      </Row>
      <Row>
        <Input {...scopedProps('pattern')} label="Pattern" description="The regex pattern" type="text" />
      </Row>
    </>
  );
};
RegexFiltered.type = 'regexFiltered';
RegexFiltered.fields = ['delegate', 'pattern'];
