import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Select, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const Bound = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Bound);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension to filter on" type="text" />
      </Row>
      <Row>
        <Input {...scopedProps('lower')} label="Lower" description="The lower bound for the filter" type="text" />
        <Checkbox
          {...scopedProps('name')}
          label="Lower strict"
          description="Perform strict comparison on the lower bound ('>' instead of '>=')"
        />
      </Row>
      <Row>
        <Input {...scopedProps('upper')} label="Upper" description="The upper bound for the filter" type="text" />
        <Checkbox
          {...scopedProps('name')}
          label="Upper strict"
          description="Perform strict comparison on the upper bound ('<' instead of '<=')"
        />
      </Row>
      <Row>
        <Select
          {...scopedProps('ordering')}
          label="Ordering"
          description="Specifies the sorting order to use when comparing values against the bound."
          entries={{
            lexicographic: 'Lexicographic',
            alphanumeric: 'Alphanumeric',
            strlen: 'String len',
            numeric: 'Numeric',
            version: 'Version',
          }}
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
Bound.type = 'bound';
Bound.fields = [
  'dimension',
  'lower',
  'lowerStrict',
  'upper',
  'upperStrict',
  'ordering',
  'extractionFn',
  'filterTuning',
];
