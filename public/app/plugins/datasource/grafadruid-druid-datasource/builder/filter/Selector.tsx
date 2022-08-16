import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const Selector = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Selector);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="the dimension name" type="text" />
        <Input {...scopedProps('value')} label="Value" description="the dimension value" type="text" />
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
Selector.type = 'selector';
Selector.fields = ['dimension', 'value', 'extractionFn', 'filterTuning'];
