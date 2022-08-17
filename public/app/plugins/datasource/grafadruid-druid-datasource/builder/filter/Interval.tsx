import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, useScopedQueryBuilderProps, Input, Row } from '../abstract';
import { Intervals } from '../querysegmentspec';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const Interval = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Interval);
  const scopedComponentProps = useScopedQueryBuilderProps(props, Interval);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension name" type="text" />
      </Row>
      <Row>
        <Intervals {...scopedComponentProps('intervals')} />
      </Row>
      <Row>
        <ExtractionFn {...scopedComponentProps('extractionFn')} />
      </Row>
      <Row>
        <FilterTuning {...scopedComponentProps('filterTuning')} />
      </Row>
    </>
  );
};
Interval.type = 'interval';
Interval.fields = ['dimension', 'intervals', 'extractionFn', 'filterTuning'];
