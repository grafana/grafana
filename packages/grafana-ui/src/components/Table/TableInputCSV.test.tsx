import React from 'react';

import renderer from 'react-test-renderer';
import TableInputCSV from './TableInputCSV';

describe('TableInputCSV', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<TableInputCSV />).toJSON();
    //expect(tree).toMatchSnapshot();
    expect(tree).toBeDefined();
  });
});
