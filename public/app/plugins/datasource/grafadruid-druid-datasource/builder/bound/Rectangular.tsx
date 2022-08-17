import React from 'react';
import { QueryBuilderProps } from '../types';
import { useScopedQueryBuilderFieldProps, Input, Multiple, Row } from '../abstract';

export const Rectangular = (props: QueryBuilderProps) => {
  const scopedProps = useScopedQueryBuilderFieldProps(props, Rectangular);
  return (
    <>
      <Row>
        <Multiple
          {...scopedProps('minCoords')}
          label="Minimum Coordinates"
          description="Coordinates in the form [x, y, z, ...]"
          component={Input}
          componentExtraProps={{
            label: 'Coordinate',
            description: 'Coordinate. e.g: 10.0',
            type: 'number',
          }}
        />
      </Row>
      <Row>
        <Multiple
          {...scopedProps('maxCoords')}
          label="Maximum Coordinates"
          description="Coordinates in the form [x, y, z, ...]"
          component={Input}
          componentExtraProps={{
            label: 'Coordinate',
            description: 'Coordinate. e.g: 10.0',
            type: 'number',
          }}
        />
      </Row>
    </>
  );
};
Rectangular.type = 'rectangular';
Rectangular.fields = ['minCoords', 'maxCoords'];
