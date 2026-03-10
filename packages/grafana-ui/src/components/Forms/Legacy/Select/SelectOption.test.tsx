import { render } from '@testing-library/react';
import { OptionProps } from 'react-select';

import SelectOption from './SelectOption';

const model: OptionProps = {
  data: vi.fn(),
  cx: vi.fn(),
  clearValue: vi.fn(),
  getStyles: vi.fn(),
  getClassNames: vi.fn(),
  getValue: vi.fn(),
  hasValue: true,
  isMulti: false,
  options: [],
  selectOption: vi.fn(),
  // @ts-ignore
  selectProps: {},
  setValue: vi.fn(),
  isDisabled: false,
  isFocused: false,
  isSelected: false,
  innerRef: vi.fn(),
  innerProps: {
    id: '',
    key: '',
    onClick: vi.fn(),
    onMouseOver: vi.fn(),
    onMouseMove: vi.fn(),
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
