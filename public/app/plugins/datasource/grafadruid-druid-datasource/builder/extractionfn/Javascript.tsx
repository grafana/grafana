import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Code, Checkbox, Row } from '../abstract';

export const Javascript = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Javascript);
  return (
    <>
      <Row>
        <Code
          {...scopedProps('function')}
          label="Function"
          description="The javascript function. e.g: function(str) { return str.substr(0, 3); }"
          lang="javascript"
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('injective')}
          label="Injective?"
          description="Specifies if the JavaScript function preserves uniqueness"
        />
      </Row>
    </>
  );
};
Javascript.type = 'javascript';
Javascript.fields = ['function', 'injective'];
