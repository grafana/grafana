import React from 'react';
import renderer from 'react-test-renderer';
import Popover from './Popover';

describe('Popover', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <Popover className="test-class" placement="auto" content="Popover text">
          <button>Button with Popover</button>
        </Popover>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
