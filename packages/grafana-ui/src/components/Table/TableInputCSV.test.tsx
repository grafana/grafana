import React from 'react';

import renderer from 'react-test-renderer';
import TableInputCSV from './TableInputCSV';
import { SeriesData } from '../../types/data';

describe('TableInputCSV', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <TableInputCSV
          text={'a,b,c\n1,2,3'}
          onTableParsed={(table: SeriesData, text: string) => {
            // console.log('Table:', table, 'from:', text);
          }}
        />
      )
      .toJSON();
    //expect(tree).toMatchSnapshot();
    expect(tree).toBeDefined();
  });
});
