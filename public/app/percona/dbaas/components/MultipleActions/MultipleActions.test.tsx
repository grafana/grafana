import React from 'react';
import { shallow, mount } from 'enzyme';
import { MultipleActions } from './MultipleActions';

describe('MultipleActions::', () => {
  it('renders correctly with actions', () => {
    const root = shallow(
      <MultipleActions
        actions={[
          {
            title: 'Test action 1',
            action: jest.fn(),
          },
          {
            title: 'Test action 2',
            action: jest.fn(),
          },
        ]}
      />
    );

    expect(root.find('span').length).toBe(2);
  });
  it('renders correctly disabled', () => {
    const root = mount(<MultipleActions actions={[]} disabled />);

    expect(root.find('button').prop('disabled')).toBeTruthy();
  });
});
