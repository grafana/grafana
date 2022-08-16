import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';

export const Regex = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Regex);
  return (
    <>
      <Row>
        <Input {...scopedProps('expr')} label="Expression" description="The regular expression" type="text" />
        <Input {...scopedProps('index')} label="Index" description="The index" type="number" />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('replaceMissingValue')}
          label="Replace missing value"
          description="Specifies if the missing value should be replaced"
        />
        <Input
          {...scopedProps('replaceMissingValueWith')}
          label="Replace missing value with"
          description="The missing value replacement"
          type="text"
        />
      </Row>
    </>
  );
};
Regex.type = 'regex';
Regex.fields = ['expr', 'index', 'replaceMissingValue', 'replaceMissingValueWith'];
