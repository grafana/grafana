import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  VariableMultiPropStaticOptionsForm,
  VariableMultiPropStaticOptionsFormProps,
} from './VariableMultiPropStaticOptionsForm';

function renderForm(props: Partial<VariableMultiPropStaticOptionsFormProps>) {
  const fullProps = { onChange: () => {}, options: [], properties: [], ...props };
  const renderResult = render(<VariableMultiPropStaticOptionsForm {...fullProps} />);

  const elements = {
    rows(mode: 'get' | 'query' = 'get') {
      if (mode === 'get') {
        const rowgroup = renderResult.getAllByRole('rowgroup')[0];
        return within(rowgroup).getAllByRole('row');
      }
      const rowgroup = renderResult.queryAllByRole('rowgroup')[0];
      return within(rowgroup).queryAllByRole('row');
    },
    rowInputs(): HTMLInputElement[][] {
      return elements.rows().map((row) => within(row).getAllByRole('textbox'));
    },
    addButton() {
      return renderResult.getByRole('button', { name: 'Add new option' });
    },
  };

  return {
    ...renderResult,
    elements,
  };
}

describe('<VariableMultiPropStaticOptionsForm />', () => {
  describe('Rendering', () => {
    test('renders a grid with column headers matching the properties and an "Add new option" button', () => {
      const { getByRole, getAllByRole } = renderForm({ options: [], properties: ['text', 'value', 'color'] });

      const grid = getByRole('grid', { name: 'Static options' });
      expect(grid).toBeInTheDocument();

      const columnHeaders = getAllByRole('columnheader');
      // first columns contains the drag icons, so the first header is empty
      expect(columnHeaders.map((h) => h.textContent)).toEqual(['', 'text', 'value', 'color']);
    });

    test('renders an "Add new option" button', () => {
      const { elements } = renderForm({ options: [], properties: ['text', 'value', 'color'] });

      expect(elements.addButton()).toBeInTheDocument();
    });

    test('when the options list is empty, renders no rows', () => {
      const { elements } = renderForm({ options: [], properties: ['text', 'value'] });

      expect(elements.rows('query')).toHaveLength(0);
    });

    test('renders option rows with the correct input values and delete buttons', () => {
      const options = [
        { label: 'Red', value: 'red', properties: { text: 'Red', value: 'red', color: '#f00' } },
        { label: 'Blue', value: 'blue', properties: { text: 'Blue', value: 'blue', color: '#00f' } },
      ];
      const { elements } = renderForm({ properties: ['text', 'value', 'color'], options });

      const rows = elements.rows();
      expect(rows).toHaveLength(2);

      const inputValues = elements.rowInputs().map((inputs) => inputs.map((input) => input.value));
      expect(inputValues).toEqual([
        ['Red', 'red', '#f00'],
        ['Blue', 'blue', '#00f'],
      ]);

      const deleteButtons = rows.map((row) => within(row).getByRole('button', { name: 'Remove option' }));
      expect(deleteButtons).toHaveLength(2);
    });

    test('when options have undefined properties, derives input values from label and value', () => {
      const options = [
        { label: 'Red', value: 'red', properties: undefined },
        { label: 'Blue', value: 'blue', properties: undefined },
      ];
      const { elements } = renderForm({ properties: ['text', 'value'], options });

      const rows = elements.rows();
      expect(rows).toHaveLength(2);

      const inputValues = elements.rowInputs().map((inputs) => inputs.map((input) => input.value));
      expect(inputValues).toEqual([
        ['Red', 'red'],
        ['Blue', 'blue'],
      ]);
    });

    test('when options have no properties, derives input values from label and value', () => {
      const options = [
        { label: 'Red', value: 'red', properties: {} },
        { label: 'Blue', value: 'blue', properties: {} },
      ];
      const { elements } = renderForm({ properties: ['text', 'value'], options });

      const rows = elements.rows();
      expect(rows).toHaveLength(2);

      const inputValues = elements.rowInputs().map((inputs) => inputs.map((input) => input.value));
      expect(inputValues).toEqual([
        ['Red', 'red'],
        ['Blue', 'blue'],
      ]);
    });
  });

  describe('User interactions', () => {
    test('clicking "Add new option" adds an empty row and calls onChange', async () => {
      const onChange = jest.fn();
      const { elements } = renderForm({ options: [], properties: ['text', 'value', 'color'], onChange });

      await userEvent.click(elements.addButton());

      expect(elements.rows()).toHaveLength(1);
      const inputValues = elements.rowInputs()[0].map((input) => input.value);
      expect(inputValues).toEqual(['', '', '']);

      expect(onChange).toHaveBeenCalledWith([{ label: '', value: '', properties: { text: '', value: '', color: '' } }]);
    });

    test('clicking the delete button removes the row and calls onChange without that option', async () => {
      const onChange = jest.fn();
      const options = [
        { label: 'Red', value: 'red', properties: { text: 'Red', value: 'red' } },
        { label: 'Blue', value: 'blue', properties: { text: 'Blue', value: 'blue' } },
      ];
      const { elements } = renderForm({ properties: ['text', 'value'], options, onChange });

      const deleteButton = within(elements.rows()[0]).getByRole('button', { name: 'Remove option' });
      await userEvent.click(deleteButton);

      expect(elements.rows()).toHaveLength(1);
      expect(elements.rowInputs()[0].map((input) => input.value)).toEqual(['Blue', 'blue']);

      expect(onChange).toHaveBeenCalledWith([
        { label: 'Blue', value: 'blue', properties: { text: 'Blue', value: 'blue' } },
      ]);
    });

    test('typing in a property input updates that property and calls onChange', async () => {
      const onChange = jest.fn();
      const options = [{ label: 'Red', value: 'red', properties: { text: 'Red', value: 'red' } }];
      const { elements } = renderForm({ properties: ['text', 'value'], options, onChange });

      const textInput = elements.rowInputs()[0][0];
      await userEvent.clear(textInput);
      await userEvent.type(textInput, 'Redish');

      expect(textInput).toHaveValue('Redish');
      expect(onChange).toHaveBeenLastCalledWith([
        { label: 'Redish', value: 'red', properties: { text: 'Redish', value: 'red' } },
      ]);
    });

    test('dragging an option reorders the rows and calls onChange', async () => {
      const onChange = jest.fn();
      const options = [
        { label: 'Red', value: 'red', properties: { text: 'Red', value: 'red' } },
        { label: 'Blue', value: 'blue', properties: { text: 'Blue', value: 'blue' } },
      ];
      const { elements, findByText } = renderForm({ properties: ['text', 'value'], options, onChange });

      const dragIcon = within(elements.rows()[0]).getByTestId('icon-draggabledots');
      const handle = dragIcon.closest('[role="button"]')!;

      // press space to start dragging
      fireEvent.keyDown(handle, { keyCode: 32 });
      await findByText(/you have lifted an item/i); // @hello-pangea/dnd announces each phase via aria-live; awaiting it ensures the library has processed the event

      // press arrow down
      fireEvent.keyDown(handle, { keyCode: 40 });
      await findByText(/you have moved the item/i);

      // press space to drop
      fireEvent.keyDown(handle, { keyCode: 32 });
      await findByText(/you have dropped the item/i);

      const inputValues = elements.rowInputs().map((inputs) => inputs.map((input) => input.value));
      expect(inputValues).toEqual([
        ['Blue', 'blue'],
        ['Red', 'red'],
      ]);

      expect(onChange).toHaveBeenLastCalledWith([
        { label: 'Blue', value: 'blue', properties: { text: 'Blue', value: 'blue' } },
        { label: 'Red', value: 'red', properties: { text: 'Red', value: 'red' } },
      ]);
    });
  });
});
