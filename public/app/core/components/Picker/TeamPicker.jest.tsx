import React from 'react';
import renderer from 'react-test-renderer';
import TeamPicker from './TeamPicker';

const model = {
  backendSrv: {
    get: () => {
      return new Promise((resolve, reject) => {});
    },
  },
  handlePicked: () => {},
};

describe('TeamPicker', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<TeamPicker {...model} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
