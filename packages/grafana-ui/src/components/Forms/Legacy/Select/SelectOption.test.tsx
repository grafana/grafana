import { render } from '@testing-library/react';
import { OptionProps } from 'react-select';

import SelectOption from './SelectOption';

const model: OptionProps = {
  data: jest.fn(),
  cx: jest.fn(),
  clearValue: jest.fn(),
  getStyles: jest.fn(),
  getClassNames: jest.fn(),
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
};

describe('SelectOption', () => {
  it('renders correctly', () => {
    const { container } = render(
      <SelectOption
        {...model}
        data={{
          imgUrl: 'url/to/avatar',
        }}
      />
    );
    expect(container).toMatchSnapshot();
  });
});
