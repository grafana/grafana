import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const Bucket = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Bucket);
  return (
    <Row>
      <Input {...scopedProps('size')} label="Size" description="The buckets size" type="number" />
      <Input {...scopedProps('offset')} label="Offset" description="The buckets offset" type="number" />
    </Row>
  );
};
Bucket.type = 'bucket';
Bucket.fields = ['size', 'offset'];
