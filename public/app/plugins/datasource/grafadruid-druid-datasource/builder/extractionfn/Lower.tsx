import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';

export const Lower = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Lower);
  return (
    <Row>
      <Input
        {...scopedProps('locale')}
        label="Locale"
        description="The optionnal locale to use to perform the transformation. e.g: fr"
        type="text"
      />
    </Row>
  );
};
Lower.type = 'lower';
Lower.fields = ['locale'];
