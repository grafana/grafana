import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Select, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';

export const Extraction = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Extraction);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
        <Input
          {...scopedProps('outputName')}
          label="Output name"
          description="The, optionnal, dimension output name"
          type="text"
        />
        <Select
          {...scopedProps('outputType')}
          label="Output type"
          description="The output type"
          entries={{ STRING: 'String', LONG: 'Long', FLOAT: 'Float' }}
        />
      </Row>
      <Row>
        <ExtractionFn {...scopedProps('extractionFn')} />
      </Row>
    </>
  );
};
Extraction.type = 'extraction';
Extraction.fields = ['dimension', 'outputName', 'outputType', 'extractionFn'];
