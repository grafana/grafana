import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Code, Row } from '../abstract';

export const Javascript = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Javascript);
  return (
    <>
      <Row>
        <Input {...scopedProps('name')} label="Name" description="Output name for the value" type="text" />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('fieldNames')}
          label="Fields names"
          description="The post-aggregators fields names"
          component={Input}
          componentExtraProps={{
            label: 'Field name',
            description: 'The field name',
            type: 'text',
          }}
        />
      </Row>
      <Row>
        <Code
          {...scopedProps('function')}
          label="Function"
          description="The javascript function. e.g: function(delta, total) { return 100 * Math.abs(delta) / total; }"
          lang="javascript"
        />
      </Row>
    </>
  );
};
Javascript.type = 'javascript';
Javascript.fields = ['name', 'fieldNames', 'function'];
