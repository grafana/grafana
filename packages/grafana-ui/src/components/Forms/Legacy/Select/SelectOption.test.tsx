import { render, screen } from '@testing-library/react';
import React from 'react';
import { OptionProps } from 'react-select';
import renderer from 'react-test-renderer';

import SelectOption from './SelectOption';

const model: OptionProps<any> = {
  data: jest.fn(),
  cx: jest.fn(),
  clearValue: jest.fn(),
  getStyles: jest.fn(),
  getValue: jest.fn(),
  hasValue: true,
  isMulti: false,
  options: [],
  selectOption: jest.fn(),
  // @ts-ignore
  selectProps: {},
  setValue: jest.fn(),
  isDisabled: false,
  isFocused: false,
  isSelected: false,
  innerRef: jest.fn(),
  innerProps: {
    id: '',
    key: '',
    onClick: jest.fn(),
    onMouseOver: jest.fn(),
    onMouseMove: jest.fn(),
    tabIndex: 1,
  },
  label: 'Option label',
  type: 'option',
  children: 'Model title',
  className: 'class-for-user-picker',
  alt: '',
};

describe('SelectOption', () => {
  it('renders correctly', () => {
    const tree = (
      <SelectOption
        {...model}
        data={{
          imgUrl: 'url/to/avatar',
        }}
      />
    );

    render(tree);
    const imageRendered = screen.getByRole('img');
    expect(imageRendered).toHaveAttribute('src', 'url/to/avatar');
    expect(imageRendered).toHaveAttribute('alt', '');
  });
});
