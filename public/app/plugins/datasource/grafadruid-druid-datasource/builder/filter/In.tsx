import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const In = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, In);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('values')}
          label="Values"
          description="The values"
          component={Input}
          componentExtraProps={{
            label: 'Value',
            description: 'A value',
            type: 'text',
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
In.type = 'in';
In.fields = ['dimension', 'values', 'extractionFn', 'filterTuning'];
