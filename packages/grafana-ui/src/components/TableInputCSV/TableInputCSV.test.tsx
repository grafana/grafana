import React from 'react';
import renderer from 'react-test-renderer';

import { DataFrame } from '@grafana/data';

import { TableInputCSV } from './TableInputCSV';

describe('TableInputCSV', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <TableInputCSV
          width={'100%'}
          height={200}
          text={'a,b,c\n1,2,3'}
          onSeriesParsed={(data: DataFrame[], text: string) => {
            // console.log('Table:', table, 'from:', text);
          }}
        />
      )
      .toJSON();
    //expect(tree).toMatchSnapshot();
    expect(tree).toBeDefined();
  });
});
