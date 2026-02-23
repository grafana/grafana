import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { select } from 'react-select-event';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { SelectBase } from './SelectBase';

// Used to select an option or options from a Select in unit tests
const selectOptionInTest = async (input: HTMLElement, optionOrOptions: string | RegExp | Array<string | RegExp>) =>
  await waitFor(() => select(input, optionOrOptions, { container: document.body }));

describe('SelectBase', () => {
  const onChangeHandler = jest.fn();
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

  it('renders without error', () => {
    expect(() => render(<SelectBase onChange={onChangeHandler} />)).not.toThrow();
  });

  it('renders empty options information', async () => {
    render(<SelectBase onChange={onChangeHandler} />);
    await userEvent.click(screen.getByText(/choose/i));
    expect(screen.queryByText(/no options found/i)).toBeVisible();
  });

  it('is selectable via its label text', async () => {
    render(
      <>
        <label htmlFor="my-select">My select</label>
        <SelectBase onChange={onChangeHandler} options={options} inputId="my-select" />
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
    expect(screen.getByText('Test label')).toBeInTheDocument();
    await userEvent.click(screen.getByText('clear value'));
    expect(screen.queryByText('Test label')).not.toBeInTheDocument();
  });

  describe('when openMenuOnFocus prop', () => {
    describe('is provided', () => {
      it('opens on focus', () => {
        render(<SelectBase onChange={onChangeHandler} openMenuOnFocus />);
        fireEvent.focus(screen.getByRole('combobox'));
        expect(screen.queryByText(/no options found/i)).toBeVisible();
      });
    });
    describe('is not provided', () => {
      it.each`
        key
        ${'{ArrowDown}'}
        ${'{ArrowUp}'}
        ${' '}
      `('opens on arrow down/up or space', async ({ key }) => {
        const user = userEvent.setup();

        render(<SelectBase onChange={onChangeHandler} />);

        await user.type(screen.getByRole('combobox'), key);
        expect(screen.queryByText(/no options found/i)).toBeVisible();
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
        render(
          <SelectBase
            onChange={onChangeHandler}
            isMulti={true}
            maxVisibleValues={3}
            options={excessiveOptions}
            value={excessiveOptions}
            isOpen={false}
          />
        );
        expect(screen.queryAllByText(/option/i).length).toBe(3);
        expect(screen.queryByText(/\(\+2\)/i)).toBeVisible();
      });

      describe('and showAllSelectedWhenOpen prop is true', () => {
        it('should show all selected options when menu is open', () => {
          render(
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

          expect(screen.queryAllByText(/option/i).length).toBe(5);
          expect(screen.queryByText(/\(\+2\)/i)).not.toBeInTheDocument();
        });
      });

      describe('and showAllSelectedWhenOpen prop is false', () => {
        it('should not show all selected options when menu is open', () => {
          render(
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

          expect(screen.queryAllByText(/option/i).length).toBe(3);
          expect(screen.queryByText(/\(\+2\)/i)).toBeVisible();
        });
      });
    });

    describe('is not provided', () => {
      it('should always show all selected options', () => {
        render(
          <SelectBase
            onChange={onChangeHandler}
            isMulti={true}
            options={excessiveOptions}
            value={excessiveOptions}
            isOpen={false}
          />
        );

        expect(screen.queryAllByText(/option/i).length).toBe(5);
        expect(screen.queryByText(/\(\+2\)/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('options', () => {
    it('renders menu with provided options', async () => {
      render(<SelectBase options={options} onChange={onChangeHandler} />);
      await userEvent.click(screen.getByText(/choose/i));
      const menuOptions = screen.getAllByTestId(selectors.components.Select.option);
      expect(menuOptions).toHaveLength(2);
    });

    it('call onChange handler when option is selected', async () => {
      const spy = jest.fn();

      render(<SelectBase onChange={spy} options={options} aria-label="My select" />);

      const selectEl = screen.getByLabelText('My select');
      expect(selectEl).toBeInTheDocument();

      await selectOptionInTest(selectEl, 'Option 2');
      expect(spy).toHaveBeenCalledWith(
        { label: 'Option 2', value: 2 },
        { action: 'select-option', name: undefined, option: undefined }
      );
    });

    it('hideSelectedOptions prop - when false does not hide selected', async () => {
      render(<SelectBase onChange={jest.fn()} options={options} aria-label="My select" hideSelectedOptions={false} />);

      const selectEl = screen.getByLabelText('My select');

      await selectOptionInTest(selectEl, 'Option 2');
      await userEvent.click(screen.getByText(/option 2/i));
      const menuOptions = screen.getAllByTestId(selectors.components.Select.option);
      expect(menuOptions).toHaveLength(2);
    });
  });

  describe('Multi select', () => {
    it('calls on change to remove an item when the user presses the remove button', async () => {
      const value = [
        {
          label: 'Option 1',
          value: 1,
        },
      ];
      render(
        <SelectBase onChange={onChangeHandler} options={options} isMulti={true} value={value} aria-label="My select" />
      );

      expect(screen.getByLabelText('My select')).toBeInTheDocument();

      await userEvent.click(screen.getAllByLabelText('Remove')[0]);
      expect(onChangeHandler).toHaveBeenCalledWith([], {
        action: 'remove-value',
        name: undefined,
        removedValue: { label: 'Option 1', value: 1 },
      });
    });

    it('does not allow deleting selected values when disabled', async () => {
      const value = [
        {
          label: 'Option 1',
          value: 1,
        },
      ];
      render(
        <SelectBase
          onChange={onChangeHandler}
          options={options}
          disabled
          isMulti={true}
          value={value}
          aria-label="My select"
        />
      );

      expect(screen.queryByLabelText('Remove Option 1')).not.toBeInTheDocument();
    });

    describe('toggle all', () => {
      it('renders menu with select all toggle', async () => {
        render(
          <SelectBase
            options={options}
            isMulti={true}
            toggleAllOptions={{ enabled: true }}
            onChange={onChangeHandler}
          />
        );
        await userEvent.click(screen.getByText(/choose/i));
        const toggleAllOptions = screen.getByTestId(selectors.components.Select.toggleAllOptions);
        expect(toggleAllOptions).toBeInTheDocument();
      });

      it('correctly displays the number of selected items', async () => {
        render(
          <SelectBase
            options={options}
            isMulti={true}
            value={[1]}
            toggleAllOptions={{ enabled: true }}
            onChange={onChangeHandler}
          />
        );
        await userEvent.click(screen.getByText(/Option 1/i));
        const toggleAllOptions = screen.getByTestId(selectors.components.Select.toggleAllOptions);
        expect(toggleAllOptions).toHaveTextContent('Selected (1)');
      });

      it('correctly removes all selected options when in indeterminate state', async () => {
        render(
          <SelectBase
            options={options}
            isMulti={true}
            value={[1]}
            toggleAllOptions={{ enabled: true }}
            onChange={onChangeHandler}
          />
        );
        await userEvent.click(screen.getByText(/Option 1/i));
        let toggleAllOptions = screen.getByTestId(selectors.components.Select.toggleAllOptions);
        expect(toggleAllOptions).toHaveTextContent('Selected (1)');

        // Toggle all unselected when in indeterminate state
        await userEvent.click(toggleAllOptions);
        expect(onChangeHandler).toHaveBeenCalledWith([], expect.anything());
      });

      it('correctly removes all selected options when all options are selected', async () => {
        render(
          <SelectBase
            options={options}
            isMulti={true}
            value={[1, 2]}
            toggleAllOptions={{ enabled: true }}
            onChange={onChangeHandler}
          />
        );
        await userEvent.click(screen.getByText(/Option 1/i));
        let toggleAllOptions = screen.getByTestId(selectors.components.Select.toggleAllOptions);
        expect(toggleAllOptions).toHaveTextContent('Selected (2)');

        // Toggle all unselected when in indeterminate state
        await userEvent.click(toggleAllOptions);
        expect(onChangeHandler).toHaveBeenCalledWith([], expect.anything());
      });

      it('correctly selects all values when none are selected', async () => {
        render(
          <SelectBase
            options={options}
            isMulti={true}
            value={[]}
            toggleAllOptions={{ enabled: true }}
            onChange={onChangeHandler}
          />
        );
        await userEvent.click(screen.getByText(/Choose/i));
        let toggleAllOptions = screen.getByTestId(selectors.components.Select.toggleAllOptions);
        expect(toggleAllOptions).toHaveTextContent('Selected (0)');

        // Toggle all unselected when in indeterminate state
        await userEvent.click(toggleAllOptions);
        expect(onChangeHandler).toHaveBeenCalledWith(options, expect.anything());
      });
    });
  });
});
