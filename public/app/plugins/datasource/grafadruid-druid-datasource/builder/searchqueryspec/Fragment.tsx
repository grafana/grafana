import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Multiple, Row } from '../abstract';

export const Fragment = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Fragment);
  return (
    <>
      <Row>
        <Checkbox
          {...scopedProps('case_sensitive')}
          label="Case sensitive"
          description="Specifies if the match should be case sensitive"
        />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('values')}
          label="Values"
          description="the set of values that has to be contained"
          component={Input}
          componentExtraProps={{
            label: 'Value',
            description: 'the value that has to be contained',
            type: 'text',
          }}
        />
      </Row>
    </>
  );
};
Fragment.type = 'fragment';
Fragment.fields = ['case_sensitive', 'values'];
