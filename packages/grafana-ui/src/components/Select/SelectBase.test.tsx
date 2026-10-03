import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { select } from 'react-select-event';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Drawer } from '../Drawer/Drawer';
import { Modal } from '../Modal/Modal';

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

  it('exposes the Select container data-testid by default', () => {
    render(<SelectBase onChange={onChangeHandler} />);
    expect(screen.getByTestId(selectors.components.Select.container)).toBeInTheDocument();
  });

  it('lets the consumer override the data-testid', () => {
    render(<SelectBase onChange={onChangeHandler} data-testid="custom-id" />);
    expect(screen.getByTestId('custom-id')).toBeInTheDocument();
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

  describe('auto-width (width="auto")', () => {
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

    beforeAll(() => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get() {
          return 120;
        },
      });
    });

    afterAll(() => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth!);
    });

    it('pins the value container width of a single-value select to the measured content width', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          value={options[0]}
          options={options}
          width="auto"
          aria-label="My select"
        />
      );

      const container = screen.getByTestId(selectors.components.Select.container);
      expect(container).toHaveStyle({ minWidth: '120px' });
    });

    it('does not pin a growing width on a multi-value select', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          isMulti
          value={options}
          options={options}
          width="auto"
          aria-label="My select"
        />
      );

      const container = screen.getByTestId(selectors.components.Select.container);
      expect(container).toHaveStyle({ minWidth: '0px' });
    });
  });

  describe('multi-value tag overflow', () => {
    it('wraps tag rows inside the container without a hard height cap on general multi-selects', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          isMulti
          value={options}
          options={options}
          width="auto"
          aria-label="My select"
        />
      );

      const container = screen.getByTestId(selectors.components.Select.container);
      expect(container).toHaveStyle({
        flexWrap: 'wrap',
        gap: '4px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      });
      // Height/scroll caps are Explore label-filter only — dashboard variables and other
      // wide multi-selects must not truncate into a 120px scroll box.
      expect(container).not.toHaveStyle({ maxHeight: '120px' });
      expect(container).not.toHaveStyle({ overflowY: 'auto' });
    });

    it('does not cap chip width on general multi-selects', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          isMulti
          value={[
            { label: 'a fairly long label that repeats', value: 1 },
            { label: 'another fairly long label', value: 2 },
          ]}
          options={[
            { label: 'a fairly long label that repeats', value: 1 },
            { label: 'another fairly long label', value: 2 },
          ]}
          aria-label="My select"
        />
      );

      const select = screen.getByTestId(selectors.components.Select.container);
      const chip = select.querySelector('[class*="grafana-select-multi-value-container"]');
      expect(chip).not.toBeNull();
      expect(chip).not.toHaveStyle({ maxWidth: '200px' });
    });

    it('caps Explore label-filter value chips and scrolls the value area instead of widening the row', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          isMulti
          value={[
            { label: 'a fairly long label that repeats', value: 1 },
            { label: 'another fairly long label', value: 2 },
          ]}
          options={[
            { label: 'a fairly long label that repeats', value: 1 },
            { label: 'another fairly long label', value: 2 },
          ]}
          data-testid="data-testid Select value"
          aria-label="My select"
        />
      );

      const select = screen.getByTestId('data-testid Select value');
      const chip = select.querySelector('[class*="grafana-select-multi-value-container"]');
      const label = select.querySelector('[class*="grafana-select-multi-value-label"]');
      const remove = select.querySelector('[class*="grafana-select-multi-value-remove"]');
      expect(chip).not.toBeNull();
      expect(label).not.toBeNull();
      expect(remove).not.toBeNull();
      expect(select).toHaveStyle({
        maxHeight: '120px',
        overflowY: 'auto',
        overflowX: 'hidden',
      });
      // Cap width on the chip wrapper; ellipsis must live on the label (a flex
      // container cannot text-overflow, and overflow there clips the remove control).
      expect(chip).toHaveStyle({ maxWidth: '200px' });
      expect(chip).not.toHaveStyle({ overflow: 'hidden' });
      expect(label).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: '0',
      });
      expect(remove).toHaveStyle({ flexShrink: '0' });
    });

    it('keeps the select column content-height and top-aligned so packed rows do not stretch it', () => {
      render(
        <SelectBase onChange={onChangeHandler} isMulti value={options} options={options} aria-label="My select" />
      );

      // The outermost react-select div is the flex item in its row (e.g. the query
      // builder label filter InputGroup). Rows default to `align-items: stretch`, so
      // the column must opt out with `align-self` to stop it growing vertically when
      // a sibling column (the value tag select) wraps onto multiple lines.
      const valueContainer = screen.getByTestId(selectors.components.Select.container);
      let column: HTMLElement | null = valueContainer;
      while (column && getComputedStyle(column).alignSelf !== 'flex-start') {
        column = column.parentElement;
      }
      expect(column).toBeInTheDocument();
      expect(column).toHaveStyle({
        alignSelf: 'flex-start',
      });

      // Wrapped tag rows stack from the top of the column instead of centering.
      expect(valueContainer).toHaveStyle({ alignItems: 'flex-start' });
    });

    it('locks single-value select boxes to 32px so packed rows do not stretch them', () => {
      render(<SelectBase onChange={onChangeHandler} options={options} aria-label="My select" />);

      // The visible bordered control box is the wrapper above the value container
      // (identified by its standard 32px min-height).
      const valueContainer = screen.getByTestId(selectors.components.Select.container);
      let box: HTMLElement | null = valueContainer;
      while (box && getComputedStyle(box).minHeight !== '32px') {
        box = box.parentElement;
      }
      expect(box).toBeInTheDocument();
      expect(box).toHaveStyle({
        height: '32px',
        minHeight: '32px',
        maxHeight: '32px',
      });
    });

    it('keeps the multi-value select box height flexible so it alone expands when tags wrap', () => {
      render(
        <SelectBase onChange={onChangeHandler} isMulti value={options} options={options} aria-label="My select" />
      );

      const valueContainer = screen.getByTestId(selectors.components.Select.container);
      let box: HTMLElement | null = valueContainer;
      while (box && getComputedStyle(box).minHeight !== '32px') {
        box = box.parentElement;
      }
      expect(box).toBeInTheDocument();
      expect(box).toHaveStyle({
        height: 'auto',
        minHeight: '32px',
      });
    });

    it('sizes key/operator selects (data-testid "Select label"/"Select match operator") to their content so packed rows do not truncate them', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          value={options[0]}
          options={options}
          width="auto"
          data-testid="data-testid Select label"
          aria-label="My select"
        />
      );

      const valueContainer = screen.getByTestId('data-testid Select label');
      let column: HTMLElement | null = valueContainer;
      while (column && getComputedStyle(column).alignSelf !== 'flex-start') {
        column = column.parentElement;
      }
      expect(column).toBeInTheDocument();
      expect(column).toHaveStyle({
        flexGrow: '0',
        flexShrink: '0',
        minWidth: 'max-content',
      });
    });

    it.each([
      { name: 'multi-value', isMulti: true as const, value: options },
      { name: 'single-value (exact match)', isMulti: false as const, value: options[0] },
    ])(
      'makes the query builder $name select absorb the leftover row space with a 200px floor',
      ({ isMulti, value }) => {
        render(
          <SelectBase
            onChange={onChangeHandler}
            isMulti={isMulti}
            value={value}
            options={options}
            width="auto"
            data-testid="data-testid Select value"
            aria-label="My select"
          />
        );

        const valueContainer = screen.getByTestId('data-testid Select value');
        let column: HTMLElement | null = valueContainer;
        while (column && getComputedStyle(column).alignSelf !== 'flex-start') {
          column = column.parentElement;
        }
        expect(column).toBeInTheDocument();
        expect(column).toHaveStyle({
          flexGrow: '1',
          flexShrink: '1',
          minWidth: '200px',
        });
      }
    );

    it('leaves other selects (no query builder data-testid) free to shrink, not locked to content width', () => {
      render(
        <SelectBase
          onChange={onChangeHandler}
          value={options[0]}
          options={options}
          width="auto"
          aria-label="My select"
        />
      );

      const valueContainer = screen.getByTestId(selectors.components.Select.container);
      let column: HTMLElement | null = valueContainer;
      while (column && getComputedStyle(column).alignSelf !== 'flex-start') {
        column = column.parentElement;
      }
      expect(column).toBeInTheDocument();
      expect(column).toHaveStyle({
        minWidth: '0',
      });
    });
  });

  describe('Escape key behavior in overlays', () => {
    it('should not close a Modal when pressing Escape while the menu is open', async () => {
      const onDismiss = jest.fn();
      render(
        <Modal title="Test Modal" isOpen onDismiss={onDismiss}>
          <SelectBase onChange={onChangeHandler} options={options} />
        </Modal>
      );

      // Modal auto-focuses the close button on open — wait for focus to settle
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());

      const input = screen.getByRole('combobox');
      await userEvent.click(input);
      expect(await screen.findByRole('option', { name: 'Option 1' })).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('should not close a Drawer when pressing Escape while the menu is open', async () => {
      const onClose = jest.fn();
      render(
        <div className="main-view">
          <Drawer title="Test Drawer" onClose={onClose}>
            <SelectBase onChange={onChangeHandler} options={options} />
          </Drawer>
        </div>
      );

      // Drawer auto-focuses the close button on open — wait for focus to settle
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());

      const input = screen.getByRole('combobox');
      await userEvent.click(input);
      expect(await screen.findByRole('option', { name: 'Option 1' })).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
