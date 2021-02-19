import React from 'react';
import renderer from 'react-test-renderer';
import { Alias } from './Alias';

describe('Alias', () => {
  it('should render component', () => {
    const tree = renderer.create(<Alias value={'legend'} onChange={() => {}} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
