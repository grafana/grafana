import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { toDataFrame, FieldType } from '@grafana/data';
import { type SortByTransformerOptions } from '@grafana/data/internal';

import { SortByTransformerEditor } from './SortByTransformerEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

const input = [
  toDataFrame({
    fields: [
      { name: 'team', type: FieldType.string, values: ['a'] },
      { name: 'score', type: FieldType.number, values: [1] },
      { name: 'name', type: FieldType.string, values: ['amy'] },
    ],
  }),
];

const setup = (initialOptions: SortByTransformerOptions) => {
  const onChange = jest.fn();

  // The editor is controlled, so the test has to feed its own output back in for reorders to show up.
  const Harness = () => {
    const [options, setOptions] = useState(initialOptions);
    return (
      <SortByTransformerEditor
        input={input}
        options={options}
        onChange={(next) => {
          onChange(next);
          setOptions(next);
        }}
      />
    );
  };

  render(<Harness />);
  return { onChange };
};

const getDragHandles = () => screen.getAllByRole('button', { name: 'Drag to change sort priority' });

describe('SortByTransformerEditor', () => {
  it('appends an empty sort field when adding', async () => {
    const { onChange } = setup({ sort: [{ field: 'team' }] });

    await userEvent.click(screen.getByRole('button', { name: 'Add sort field' }));

    expect(onChange).toHaveBeenCalledWith({ sort: [{ field: 'team' }, { field: '' }] });
  });

  it('removes only the clicked sort field', async () => {
    const { onChange } = setup({ sort: [{ field: 'team' }, { field: 'score', desc: true }] });

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove sort field' })[0]);

    expect(onChange).toHaveBeenCalledWith({ sort: [{ field: 'score', desc: true }] });
  });

  it('does not add a sort field when every field is already used', async () => {
    const { onChange } = setup({ sort: [{ field: 'team' }, { field: 'score' }, { field: 'name' }] });

    const addButton = screen.getByRole('button', { name: 'Add sort field' });
    expect(addButton).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(addButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('picks up sort fields changed outside the editor', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <SortByTransformerEditor input={input} options={{ sort: [{ field: 'team' }] }} onChange={onChange} />
    );

    rerender(
      <SortByTransformerEditor
        input={input}
        options={{ sort: [{ field: 'team' }, { field: 'score', desc: true }] }}
        onChange={onChange}
      />
    );

    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.getAllByRole('switch')[1]).toBeChecked();
  });

  it('does not offer removing the only sort field', () => {
    setup({ sort: [{ field: 'team' }] });

    expect(screen.getByRole('button', { name: 'Add sort field' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove sort field' })).not.toBeInTheDocument();
  });

  it('changes the field of the second row without touching the first', async () => {
    const { onChange } = setup({ sort: [{ field: 'team', desc: true }, { field: '' }] });

    await selectOptionInTest(screen.getAllByRole('combobox')[1], 'name');

    expect(onChange).toHaveBeenCalledWith({ sort: [{ field: 'team', desc: true }, { field: 'name' }] });
  });

  it('toggles reverse only on the clicked row', async () => {
    const { onChange } = setup({ sort: [{ field: 'team' }, { field: 'score' }] });

    await userEvent.click(screen.getAllByRole('switch')[1]);

    expect(onChange).toHaveBeenCalledWith({ sort: [{ field: 'team' }, { field: 'score', desc: true }] });
  });

  it('does not offer fields already picked in other rows', async () => {
    setup({ sort: [{ field: 'team' }, { field: '' }] });

    await userEvent.click(screen.getAllByRole('combobox')[1]);

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['score', 'name']);
  });

  it('moves a sort field down when dragged with the keyboard', async () => {
    const { onChange } = setup({ sort: [{ field: 'team' }, { field: 'score', desc: true }] });

    await dragFirstFieldDownWithKeyboard();

    expect(onChange).toHaveBeenCalledWith({ sort: [{ field: 'score', desc: true }, { field: 'team' }] });
  });

  it('keeps focus on the moved row after a keyboard drag', async () => {
    setup({ sort: [{ field: 'team' }, { field: 'score', desc: true }] });

    const handle = await dragFirstFieldDownWithKeyboard();

    await waitFor(() => expect(getDragHandles()[1]).toBe(handle));
    expect(handle).toHaveFocus();
  });
});

async function dragFirstFieldDownWithKeyboard() {
  const handle = getDragHandles()[0];
  handle.focus();

  // @hello-pangea/dnd announces each phase via aria-live; awaiting it ensures the library processed the key
  fireEvent.keyDown(handle, { keyCode: 32 });
  await screen.findByText(/you have lifted an item/i);
  fireEvent.keyDown(handle, { keyCode: 40 });
  await screen.findByText(/you have moved the item/i);
  fireEvent.keyDown(handle, { keyCode: 32 });
  await screen.findByText(/you have dropped the item/i);

  return handle;
}
