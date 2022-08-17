import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderProps, useScopedQueryBuilderFieldProps, Input, Checkbox, Row } from '../abstract';
import { Granularity } from '../granularity';

export const TimeFormat = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, TimeFormat);
  const scopedComponentProps = useScopedQueryBuilderProps(props, TimeFormat);
  return (
    <>
      <Row>
        <Input {...scopedProps('format')} label="Format" description="The format" type="text" />
        <Input {...scopedProps('timeZone')} label="Time zone" description="The time zone" type="text" />
        <Input {...scopedProps('locale')} label="Locale" description="The locale" type="text" />
      </Row>
      <Row>
        <Checkbox
          {...scopedProps('asMillis')}
          label="As millis?"
          description="Treat input strings as millis rather than ISO8601 strings"
        />
      </Row>
      <Row>
        <Granularity {...scopedComponentProps('granularity')} />
      </Row>
    </>
  );
};
TimeFormat.type = 'timeFormat';
TimeFormat.fields = ['format', 'timeZone', 'locale', 'asMillis', 'granularity'];
