import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { Dimension } from '../dimension';

export const PrefixFiltered = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, PrefixFiltered);
  return (
    <>
      <Row>
        <Dimension {...scopedProps('delegate')} />
      </Row>
      <Row>
        <Input {...scopedProps('prefix')} label="Prefix" description="The prefix to use" type="text" />
      </Row>
    </>
  );
};
PrefixFiltered.type = 'prefixFiltered';
PrefixFiltered.fields = ['delegate', 'prefix'];
