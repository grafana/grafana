import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const Regex = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Regex);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
        <Input {...scopedProps('pattern')} label="Pattern" description="The regex pattern" type="text" />
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
Regex.type = 'regex';
Regex.fields = ['dimension', 'pattern', 'extractionFn', 'filterTuning'];
