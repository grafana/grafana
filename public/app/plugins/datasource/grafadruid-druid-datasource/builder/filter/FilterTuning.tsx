import React from 'react';
import { InlineLabel } from '@grafana/ui';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';

export const FilterTuning = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, FilterTuning);
  return (
    <>
      <InlineLabel
        tooltip="Provides a mechansim to influence whether or not indexes are used for a Filter during processing"
        width="auto"
      >
        Filter tuning
      </InlineLabel>
      <Row>
        <Input
          {...scopedProps('minCardinalityToUseBitmapIndex')}
          label="Min cardinality to use bitmap index"
          description="Allow using bitmap index only if cardinality is over min value"
          type="number"
        />
        <Input
          {...scopedProps('maxCardinalityToUseBitmapIndex')}
          label="Max cardinality to use bitmap index"
          description="Allow using a bitmap index only if cardinality is under max value"
          type="number"
        />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('useBitmapIndex')}
          label="Use bitmap index?"
          description="If set to false will disallow a filter to utilize bitmap indexes"
        />
      </Row>
    </>
  );
};
FilterTuning.type = 'filterTuning';
FilterTuning.fields = ['minCardinalityToUseBitmapIndex', 'maxCardinalityToUseBitmapIndex', 'useBitmapIndex'];
