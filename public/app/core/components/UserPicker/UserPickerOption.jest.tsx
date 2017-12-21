import React from 'react';
import renderer from 'react-test-renderer';
import UserPickerOption from './UserPickerOption';

const model = {
  onSelect: () => {},
  onFocus: () => {},
  isFocused: () => {},
  option: {
    title: 'Model title',
    avatarUrl: 'url/to/avatar',
    label: 'User picker label',
  },
  className: 'class-for-user-picker',
};

describe('UserPickerOption', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<UserPickerOption {...model} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
