import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Row } from '../abstract';
import { ExtractionFn } from '../extractionfn';
import { FilterTuning } from '.';

export const Like = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Like);
  return (
    <>
      <Row>
        <Input {...scopedProps('dimension')} label="Dimension" description="The dimension to filter on." type="text" />
        <Input
          {...scopedProps('pattern')}
          label="Pattern"
          description="LIKE pattern, such as 'foo%' or '___bar'."
          type="text"
        />
        <Input
          {...scopedProps('escape')}
          label="Escape"
          description="An escape character that can be used to escape special characters."
          type="text"
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
Like.type = 'like';
Like.fields = ['dimension', 'pattern', 'escape', 'extractionFn', 'filterTuning'];
