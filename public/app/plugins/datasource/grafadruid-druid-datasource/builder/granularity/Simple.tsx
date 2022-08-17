import React from 'react';
import { QueryBuilderProps } from '../types';
import { Select, Row } from '../abstract';

export const Simple = (props: QueryBuilderProps) => {
  const { options, onOptionsChange } = props;
  return (
    <Row>
      <Select
        options={options}
        onOptionsChange={onOptionsChange}
        name="Granularity"
        label="Granularity"
        description="Specifies the granularity to use to bucket timestamps"
        entries={{
          all: 'All',
          none: 'None',
          second: 'Second',
          minute: 'Minute',
          fifteen_minute: 'Fifteen minutes',
          thirty_minute: 'Thirty minutes',
          hour: 'Hour',
          day: 'Day',
          week: 'Week',
          month: 'Month',
          quarter: 'Quarter',
          year: 'Year',
        }}
      />
    </Row>
  );
};
Simple.type = 'simple';
Simple.fields = [] as string[];
