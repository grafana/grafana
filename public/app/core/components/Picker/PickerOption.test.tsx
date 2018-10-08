import React from 'react';
import renderer from 'react-test-renderer';
import PickerOption from './PickerOption';

const model = {
  cx: jest.fn(),
  clearValue: jest.fn(),
  onSelect: jest.fn(),
  getStyles: jest.fn(),
  children: 'Model title',
  data: {
    title: 'Model title',
    avatarUrl: 'url/to/avatar',
    label: 'User picker label',
  },
  className: 'class-for-user-picker',
};

describe('PickerOption', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<PickerOption {...model} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
