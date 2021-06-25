import React, { useState } from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import selectEvent from 'react-select-event';
import { SelectBase } from './SelectBase';
import { SelectBaseProps } from './types';
import { SelectableValue } from '@grafana/data';
import { MultiValueContainer } from './MultiValue';

const onChangeHandler = () => jest.fn();
const findMenuElement = (container: ReactWrapper) => container.find({ 'aria-label': 'Select options menu' });
const options: Array<SelectableValue<number>> = [
  {
    label: 'Option 1',
    value: 1,
  },
  {
    label: 'Option 2',
    value: 2,
  },
];

describe('SelectBase', () => {
  it('renders without error', () => {
    mount(<SelectBase onChange={onChangeHandler} />);
  });

  it('renders empty options information', () => {
    const container = mount(<SelectBase onChange={onChangeHandler} isOpen />);
    const noopt = container.find({ 'aria-label': 'No options provided' });
    expect(noopt).toHaveLength(1);
  });

  it('is selectable via its label text', async () => {
    const onChange = jest.fn();

    render(
      <>
        <label htmlFor="my-select">My select</label>
        <SelectBase onChange={onChange} options={options} inputId="my-select" />
      </>
    );

    expect(screen.getByLabelText('My select')).toBeInTheDocument();
  });

  it('allows the value to be unset', async () => {
    const Test = () => {
      const option = { value: 'test-value', label: 'Test label' };
      const [value, setValue] = useState<SelectableValue<string> | null>(option);

      return (
        <>
          <button onClick={() => setValue(null)}>clear value</button>
          <SelectBase value={value} onChange={setValue} options={[option]} />
        </>
      );
    };

    render(<Test />);
    expect(screen.queryByText('Test label')).toBeInTheDocument();
    userEvent.click(screen.getByText('clear value'));
    expect(screen.queryByText('Test label')).not.toBeInTheDocument();
  });

  describe('when openMenuOnFocus prop', () => {
    describe('is provided', () => {
      it('opens on focus', () => {
        const container = mount(<SelectBase onChange={onChangeHandler} openMenuOnFocus />);
        container.find('input').simulate('focus');

        const menu = findMenuElement(container);
        expect(menu).toHaveLength(1);
      });
    });
    describe('is not provided', () => {
      it.each`
        key
        ${'ArrowDown'}
        ${'ArrowUp'}
        ${' '}
      `('opens on arrow down/up or space', ({ key }) => {
        const container = mount(<SelectBase onChange={onChangeHandler} />);
        const input = container.find('input');
        input.simulate('focus');
        input.simulate('keydown', { key });
        const menu = findMenuElement(container);
        expect(menu).toHaveLength(1);
      });
    });
  });

  describe('when maxVisibleValues prop', () => {
    let excessiveOptions: Array<SelectableValue<number>> = [];
    beforeAll(() => {
      excessiveOptions = [
        {
          label: 'Option 1',
          value: 1,
        },
        {
          label: 'Option 2',
          value: 2,
        },
        {
          label: 'Option 3',
          value: 3,
        },
        {
          label: 'Option 4',
          value: 4,
        },
        {
          label: 'Option 5',
          value: 5,
        },
      ];
    });

    describe('is provided', () => {
      it('should only display maxVisibleValues options, and additional number of values should be displayed as indicator', () => {
        const container = mount(
          <SelectBase
            onChange={onChangeHandler}
            isMulti={true}
            maxVisibleValues={3}
            options={excessiveOptions}
            value={excessiveOptions}
            isOpen={false}
          />
        );

        expect(container.find(MultiValueContainer)).toHaveLength(3);
        expect(container.find('#excess-values').text()).toBe('(+2)');
      });

      describe('and showAllSelectedWhenOpen prop is true', () => {
        it('should show all selected options when menu is open', () => {
          const container = mount(
            <SelectBase
              onChange={onChangeHandler}
              isMulti={true}
              maxVisibleValues={3}
              options={excessiveOptions}
              value={excessiveOptions}
              showAllSelectedWhenOpen={true}
              isOpen={true}
            />
          );

          expect(container.find(MultiValueContainer)).toHaveLength(5);
          expect(container.find('#excess-values')).toHaveLength(0);
        });
      });

      describe('and showAllSelectedWhenOpen prop is false', () => {
        it('should not show all selected options when menu is open', () => {
          const container = mount(
            <SelectBase
              onChange={onChangeHandler}
              isMulti={true}
              maxVisibleValues={3}
              value={excessiveOptions}
              options={excessiveOptions}
              showAllSelectedWhenOpen={false}
              isOpen={true}
            />
          );

          expect(container.find('#excess-values').text()).toBe('(+2)');
          expect(container.find(MultiValueContainer)).toHaveLength(3);
        });
      });
    });

    describe('is not provided', () => {
      it('should always show all selected options', () => {
        const container = mount(
          <SelectBase
            onChange={onChangeHandler}
            isMulti={true}
            options={excessiveOptions}
            value={excessiveOptions}
            isOpen={false}
          />
        );

        expect(container.find(MultiValueContainer)).toHaveLength(5);
        expect(container.find('#excess-values')).toHaveLength(0);
      });
    });
  });

  describe('options', () => {
    it('renders menu with provided options', () => {
      render(<SelectBase options={options} onChange={onChangeHandler} isOpen />);
      const menuOptions = screen.getAllByLabelText('Select option');
      expect(menuOptions).toHaveLength(2);
    });

    it('call onChange handler when option is selected', async () => {
      const spy = jest.fn();

      render(<SelectBase onChange={spy} options={options} aria-label="My select" />);

      const selectEl = screen.getByLabelText('My select');
      expect(selectEl).toBeInTheDocument();

      await selectEvent.select(selectEl, 'Option 2');
      expect(spy).toHaveBeenCalledWith({
        label: 'Option 2',
        value: 2,
      });
    });
  });

  describe('When allowCustomValue is set to true', () => {
    it('Should allow creating a new option', async () => {
      const valueIsStrictlyEqual: SelectBaseProps<string>['filterOption'] = (option, value) => option.value === value;
      const valueIsStrictlyNotEqual: SelectBaseProps<string>['isValidNewOption'] = (newOption, _, options) =>
        options.every(({ value }) => value !== newOption);

      const spy = jest.fn();
      render(
        <SelectBase
          onChange={spy}
          isOpen
          allowCustomValue
          filterOption={valueIsStrictlyEqual}
          isValidNewOption={valueIsStrictlyNotEqual}
        />
      );

      const textBox = screen.getByRole('textbox');
      userEvent.type(textBox, 'NOT AN OPTION');

      let creatableOption = screen.getByLabelText('Select option');
      expect(creatableOption).toBeInTheDocument();
      expect(creatableOption).toHaveTextContent('Create: NOT AN OPTION');

      userEvent.click(creatableOption);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'NOT AN OPTION',
          value: 'NOT AN OPTION',
        })
      );

      // Should also create options in a case-insensitive way.
      userEvent.type(textBox, 'not an option');

      creatableOption = screen.getByLabelText('Select option');
      expect(creatableOption).toBeInTheDocument();
      expect(creatableOption).toHaveTextContent('Create: not an option');

      userEvent.click(creatableOption);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'not an option',
          value: 'not an option',
        })
      );
    });
  });
});
