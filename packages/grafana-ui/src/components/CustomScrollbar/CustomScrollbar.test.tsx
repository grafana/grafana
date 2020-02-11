import React from 'react';
import renderer from 'react-test-renderer';
import CustomScrollbar from './CustomScrollbar';

describe('CustomScrollbar', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <CustomScrollbar>
          <p>Scrollable content</p>
        </CustomScrollbar>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
