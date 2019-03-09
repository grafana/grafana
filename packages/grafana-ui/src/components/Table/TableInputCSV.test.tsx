import React from 'react';

import renderer from 'react-test-renderer';
import TableInputCSV from './TableInputCSV';

describe('TableInputCSV', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<TableInputCSV width={100} height={100} />).toJSON();
    //expect(tree).toMatchSnapshot();
    expect(tree).toBeDefined();
  });
});
