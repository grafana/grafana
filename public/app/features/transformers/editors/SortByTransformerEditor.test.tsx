import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const setup = (options: SortByTransformerOptions) => {
  const onChange = jest.fn();
  render(<SortByTransformerEditor input={input} options={options} onChange={onChange} />);
  return { onChange };
};

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

    const handle = screen.getAllByRole('button', { name: 'Drag to change sort priority' })[0];

    // @hello-pangea/dnd announces each phase via aria-live; awaiting it ensures the library processed the key
    fireEvent.keyDown(handle, { keyCode: 32 });
    await screen.findByText(/you have lifted an item/i);
    fireEvent.keyDown(handle, { keyCode: 40 });
    await screen.findByText(/you have moved the item/i);
    fireEvent.keyDown(handle, { keyCode: 32 });
    await screen.findByText(/you have dropped the item/i);

    expect(onChange).toHaveBeenCalledWith({ sort: [{ field: 'score', desc: true }, { field: 'team' }] });
  });
});
