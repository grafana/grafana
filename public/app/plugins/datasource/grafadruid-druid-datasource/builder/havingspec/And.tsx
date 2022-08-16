import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Multiple, Row } from '../abstract';
import { HavingSpec } from './';

export const And = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, And);
  return (
    <Row>
      <Multiple
        {...scopedProps('havingSpecs')}
        label="And"
        description="The having filters"
        component={HavingSpec}
        componentExtraProps={{}}
      />
    </Row>
  );
};
And.type = 'and';
And.fields = ['havingSpecs'];
