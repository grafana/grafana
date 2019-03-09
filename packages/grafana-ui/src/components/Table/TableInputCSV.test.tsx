import React from 'react';

import renderer from 'react-test-renderer';
import TableInputCSV, { ParseResults } from './TableInputCSV';

describe('TableInputCSV', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <TableInputCSV
          width={100}
          height={100}
          onTableParsed={(results: ParseResults) => {
            console.log('GOT', results);
          }}
        />
      )
      .toJSON();
    //expect(tree).toMatchSnapshot();
    expect(tree).toBeDefined();
  });
});
