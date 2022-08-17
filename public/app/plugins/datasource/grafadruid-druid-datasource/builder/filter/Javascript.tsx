import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Code, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const Javascript = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Javascript);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
      </Row>
      <Row>
        <Code
          {...scopedProps('function')}
          label="Function"
          description="The javascript function. e.g: function(x) { return(x >= 'bar' && x <= 'foo') }"
          lang="javascript"
        />
      </Row>
      <Row>
        <ExtractionFn {...scopedProps('extractionFn')} />
      </Row>
      <Row>
        <FilterTuning {...scopedProps('filterTuning')} />
      </Row>
    </>
  );
};
Javascript.type = 'javascript';
Javascript.fields = ['dimension', 'function', 'extractionFn', 'filterTuning'];
